import { Schema, Document, CallbackError } from 'mongoose';
import { encryptField, decryptField, isEncrypted } from '../../utils/fieldCrypto';

export interface EncryptedFieldsPluginOptions {
  fields: string[];
}

/**
 * =============================================================================
 * MONGOOSE FIELD-LEVEL ENCRYPTION PLUGIN (AES-256-GCM)
 * =============================================================================
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS & SEARCHABILITY LIMITATIONS:
 *
 * 1. NO RANGE OR EQUALITY SEARCHES:
 *    Fields encrypted with this plugin cannot be queried using equality filters ($eq),
 *    range filters ($gt, $lt), regular expressions ($regex), or text search ($text).
 *    Because AES-256-GCM utilizes a random 12-byte IV for every individual write,
 *    identical plaintext values produce completely distinct ciphertexts (probabilistic encryption).
 *
 * 2. NO INDEXING OR SORTING:
 *    Encrypted fields cannot be meaningfully sorted ($sort) or indexed. B-tree indexes
 *    on ciphertext values only index random base64url bytes.
 *
 * 3. MANDATORY PLAINTEXT EXCLUSIONS:
 *    The following fields MUST REMAIN PLAINTEXT and MUST NEVER be encrypted with this plugin:
 *    - `email`: Required for unique login lookups, authentication, and user checks.
 *    - `role`: Required for role-based access control (RBAC) authorization filters.
 *    - `_id` & Foreign Keys (`user`, `order`, `product`, `category`): Document references.
 *    - `status`: Required for order pipelines, queue filters, and lifecycle transitions.
 *    - Routing Geography (`city`, `province`, `postalCode`, `country`): Required for
 *      shipping fee computation, postal dispatch sorting, and delivery zone routing.
 * =============================================================================
 */

/**
 * Helper to get a model name safely from a Mongoose document or query context
 */
function getModelName(context: any): string {
  if (context?.constructor?.modelName) {
    return context.constructor.modelName;
  }
  if (context?.model?.modelName) {
    return context.model.modelName;
  }
  return 'Model';
}

/**
 * Processes a single document (in-memory or subdocument) to encrypt specified fields
 */
function encryptDocFields(doc: any, fields: string[], modelName: string): void {
  if (!doc) return;

  for (const field of fields) {
    const aad = `${modelName}.${field}`;

    if (field.includes('.')) {
      const parts = field.split('.');
      const parentKey = parts[0];
      const childKey = parts.slice(1).join('.');

      const parentVal = typeof doc.get === 'function' ? doc.get(parentKey) : doc[parentKey];
      if (!parentVal) continue;

      if (Array.isArray(parentVal)) {
        // Array of subdocuments (e.g. addresses.line1)
        for (const item of parentVal) {
          encryptDocFields(item, [childKey], `${modelName}.${parentKey}`);
        }
      } else if (typeof parentVal === 'object') {
        // Nested subdocument (e.g. shippingAddress.line1)
        encryptDocFields(parentVal, [childKey], `${modelName}.${parentKey}`);
      }
    } else {
      const val = typeof doc.get === 'function' ? doc.get(field) : doc[field];
      if (typeof val === 'string' && !isEncrypted(val)) {
        const encrypted = encryptField(val, aad);
        if (typeof doc.set === 'function') {
          doc.set(field, encrypted);
        } else {
          doc[field] = encrypted;
        }
      }
    }
  }
}

/**
 * Processes a single document to decrypt specified fields into memory
 */
function decryptDocFields(doc: any, fields: string[], modelName: string): void {
  if (!doc) return;

  for (const field of fields) {
    const aad = `${modelName}.${field}`;

    if (field.includes('.')) {
      const parts = field.split('.');
      const parentKey = parts[0];
      const childKey = parts.slice(1).join('.');

      const parentVal = typeof doc.get === 'function' ? doc.get(parentKey) : doc[parentKey];
      if (!parentVal) continue;

      if (Array.isArray(parentVal)) {
        for (const item of parentVal) {
          decryptDocFields(item, [childKey], `${modelName}.${parentKey}`);
        }
      } else if (typeof parentVal === 'object') {
        decryptDocFields(parentVal, [childKey], `${modelName}.${parentKey}`);
      }
    } else {
      const val = typeof doc.get === 'function' ? doc.get(field) : doc[field];
      if (typeof val === 'string' && isEncrypted(val)) {
        const decrypted = decryptField(val, aad);
        if (typeof doc.set === 'function') {
          doc.set(field, decrypted);
        } else {
          doc[field] = decrypted;
        }
      }
    }
  }
}

/**
 * Processes an update query payload ($set, $setOnInsert, direct) to encrypt matching fields
 */
function encryptUpdatePayload(update: any, fields: string[], modelName: string): void {
  if (!update || typeof update !== 'object') return;

  const processObject = (targetObj: any) => {
    if (!targetObj || typeof targetObj !== 'object') return;

    for (const field of fields) {
      const aad = `${modelName}.${field}`;

      // 1. Direct dotted key match (e.g. { 'shippingAddress.line1': '123 Main' } or { 'addresses.0.line1': '123 Main' })
      for (const key of Object.keys(targetObj)) {
        const normalizedKey = key.replace(/\.\d+\./g, '.').replace(/\.\$\./g, '.');
        if (
          (key === field || normalizedKey === field) &&
          typeof targetObj[key] === 'string' &&
          !isEncrypted(targetObj[key])
        ) {
          targetObj[key] = encryptField(targetObj[key], aad);
        }
      }

      // 2. Nested object or array match (e.g. { shippingAddress: { line1: '123 Main' } } or { addresses: [{ line1: '123' }] })
      if (field.includes('.')) {
        const parts = field.split('.');
        const parentKey = parts[0];
        const childKey = parts.slice(1).join('.');
        const current = targetObj[parentKey];

        if (Array.isArray(current)) {
          for (const item of current) {
            if (item && typeof item === 'object') {
              encryptUpdatePayload(item, [childKey], `${modelName}.${parentKey}`);
            }
          }
        } else if (current && typeof current === 'object') {
          encryptUpdatePayload(current, [childKey], `${modelName}.${parentKey}`);
        }
      }
    }
  };

  // Process top-level fields
  processObject(update);

  // Process atomic operators
  if (update.$set) processObject(update.$set);
  if (update.$setOnInsert) processObject(update.$setOnInsert);
}

export function encryptedFieldsPlugin(schema: Schema, options: EncryptedFieldsPluginOptions): void {
  const fields = options?.fields || [];
  if (fields.length === 0) return;

  // 1. Pre-save hook: Encrypt modified fields before saving to MongoDB
  schema.pre('save', function (this: any, next: (err?: CallbackError) => void) {
    const modelName = getModelName(this);
    encryptDocFields(this, fields, modelName);
    next();
  });

  // 2. Post-save hook: Decrypt in-memory document so callers continue reading plaintext
  schema.post('save', function (doc: any) {
    const modelName = getModelName(doc);
    decryptDocFields(doc, fields, modelName);
  });

  // 3. Post-init hook: Decrypt stored ciphertext when documents are loaded from database
  schema.post('init', function (doc: any) {
    const modelName = getModelName(doc);
    decryptDocFields(doc, fields, modelName);
  });

  // 4. Pre-query update hooks: Encrypt update payloads before sending to MongoDB
  const updateHooks = ['findOneAndUpdate', 'updateOne', 'updateMany'] as const;
  for (const hook of updateHooks) {
    schema.pre(hook, function (this: any, next: (err?: CallbackError) => void) {
      const modelName = getModelName(this);
      const update = this.getUpdate();
      if (update) {
        encryptUpdatePayload(update, fields, modelName);
      }
      next();
    });
  }

  // 5. Pre-insertMany hook: Encrypt bulk inserted documents
  schema.pre('insertMany', function (this: any, next: (err?: CallbackError) => void, docs: any[]) {
    const modelName = getModelName(this);
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        encryptDocFields(doc, fields, modelName);
      }
    }
    next();
  });
}
