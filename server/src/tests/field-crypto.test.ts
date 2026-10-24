/// <reference types="jest" />
import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';
import {
  encryptField,
  decryptField,
  isEncrypted,
  needsReencryption,
  parseKeyRing,
  setKeyRingForTesting,
  resetKeyRing,
} from '../utils/fieldCrypto';
import { encryptedFieldsPlugin } from '../models/plugins/encryptedFields';
import { env, envSchema } from '../config/env';

describe('HIPAA01: AES-256-GCM Field-Level Cryptography Engine (fieldCrypto.ts)', () => {
  const testKey1 = crypto.randomBytes(32);
  const testKey2 = crypto.randomBytes(32);

  beforeEach(() => {
    // Set predictable test keyring with v1 active
    const testRing = new Map<string, Buffer>();
    testRing.set('1', testKey1);
    testRing.set('v1', testKey1);
    testRing.set('2', testKey2);
    testRing.set('v2', testKey2);
    setKeyRingForTesting(testRing, '1');
  });

  afterAll(() => {
    resetKeyRing();
  });

  it('performs round-trip encryption and decryption with AAD context', () => {
    const plaintext = '+94771234567';
    const context = 'User.phone';

    const ciphertext = encryptField(plaintext, context);
    expect(ciphertext).toBeDefined();
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.startsWith('enc:v1:')).toBe(true);
    expect(isEncrypted(ciphertext)).toBe(true);

    const decrypted = decryptField(ciphertext, context);
    expect(decrypted).toBe(plaintext);
  });

  it('generates distinct ciphertexts for identical plaintext (random 12-byte IV)', () => {
    const plaintext = '42 Flower Road, Colombo 07';
    const context = 'Order.shippingAddress.line1';

    const c1 = encryptField(plaintext, context);
    const c2 = encryptField(plaintext, context);

    expect(c1).not.toBe(c2);
    expect(decryptField(c1, context)).toBe(plaintext);
    expect(decryptField(c2, context)).toBe(plaintext);
  });

  it('detects tampering and throws when ciphertext or auth tag is corrupted', () => {
    const plaintext = 'Secret Notes';
    const context = 'User.notes';
    const ciphertext = encryptField(plaintext, context);

    const parts = ciphertext.split(':');
    expect(parts.length).toBe(5);

    // Tamper 1: Flip bit in ciphertext payload (parts[4])
    const cipherChars = parts[4].split('');
    cipherChars[0] = cipherChars[0] === 'A' ? 'B' : 'A';
    const tamperedCipher = [parts[0], parts[1], parts[2], parts[3], cipherChars.join('')].join(':');

    expect(() => decryptField(tamperedCipher, context)).toThrow(
      /authentication tag mismatch or corrupted ciphertext/i
    );

    // Tamper 2: Flip bit in auth tag (parts[3])
    const tagChars = parts[3].split('');
    tagChars[0] = tagChars[0] === 'A' ? 'B' : 'A';
    const tamperedTag = [parts[0], parts[1], parts[2], tagChars.join(''), parts[4]].join(':');

    expect(() => decryptField(tamperedTag, context)).toThrow(
      /authentication tag mismatch or corrupted ciphertext/i
    );

    // Tamper 3: Flip bit in IV (parts[2])
    const ivChars = parts[2].split('');
    ivChars[0] = ivChars[0] === 'A' ? 'B' : 'A';
    const tamperedIv = [parts[0], parts[1], ivChars.join(''), parts[3], parts[4]].join(':');

    expect(() => decryptField(tamperedIv, context)).toThrow(
      /authentication tag mismatch or corrupted ciphertext/i
    );
  });

  it('detects AAD context mismatch and rejects cross-field injection', () => {
    const plaintext = '+94770001122';
    const ciphertext = encryptField(plaintext, 'User.phone');

    // Attempting to decrypt with a different context must fail
    expect(() => decryptField(ciphertext, 'Supplier.phone')).toThrow(
      /authentication tag mismatch or corrupted ciphertext/i
    );
    expect(() => decryptField(ciphertext, 'User.emergencyPhone')).toThrow(
      /authentication tag mismatch or corrupted ciphertext/i
    );

    // Matching context succeeds
    expect(decryptField(ciphertext, 'User.phone')).toBe(plaintext);
  });

  it('supports seamless key rotation and indicates re-encryption requirement', () => {
    const plaintext = 'Rotate me safely';
    const context = 'User.notes';

    // Encrypted under active version 1
    const v1Cipher = encryptField(plaintext, context);
    expect(v1Cipher.startsWith('enc:v1:')).toBe(true);
    expect(needsReencryption(v1Cipher)).toBe(false);

    // Rotate active key version to 2
    const rotatedRing = new Map<string, Buffer>();
    rotatedRing.set('1', testKey1);
    rotatedRing.set('v1', testKey1);
    rotatedRing.set('2', testKey2);
    rotatedRing.set('v2', testKey2);
    setKeyRingForTesting(rotatedRing, '2');

    // v1Cipher requires re-encryption under active key 2
    expect(needsReencryption(v1Cipher)).toBe(true);

    // v1Cipher can still be decrypted because key 1 is retained in keyring
    const decryptedWithV1 = decryptField(v1Cipher, context);
    expect(decryptedWithV1).toBe(plaintext);

    // Re-encrypt under active key 2
    const v2Cipher = encryptField(decryptedWithV1, context);
    expect(v2Cipher.startsWith('enc:v2:')).toBe(true);
    expect(needsReencryption(v2Cipher)).toBe(false);
    expect(decryptField(v2Cipher, context)).toBe(plaintext);

    // Purge retired key 1 from keyring
    const purgedRing = new Map<string, Buffer>();
    purgedRing.set('2', testKey2);
    purgedRing.set('v2', testKey2);
    setKeyRingForTesting(purgedRing, '2');

    // Attempting to decrypt v1 without key 1 in keyring throws key missing error
    expect(() => decryptField(v1Cipher, context)).toThrow(
      /Decryption key version 'v1' not found in key ring/i
    );
  });

  it('passes legacy plaintext through untouched for backward compatibility', () => {
    const legacyValue = '0771234567';
    expect(isEncrypted(legacyValue)).toBe(false);
    expect(decryptField(legacyValue, 'User.phone')).toBe(legacyValue);
    expect(decryptField('', 'User.phone')).toBe('');
    expect(decryptField(null as unknown as string, 'User.phone')).toBe(null);
    expect(decryptField(undefined as unknown as string, 'User.phone')).toBe(undefined);
  });
});

describe('HIPAA01: Mongoose Encrypted Fields Plugin (encryptedFieldsPlugin)', () => {
  interface ITestAddress {
    line1: string;
    city: string;
  }

  interface ITestCustomerRecord {
    customerRef: string;
    phone: string;
    shippingAddress: ITestAddress;
    savedAddresses?: ITestAddress[];
    status: string;
  }

  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const modelName = `TestRecord_${uniqueSuffix}`;
  let TestModel: mongoose.Model<ITestCustomerRecord>;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || env.MONGO_URI || 'mongodb://localhost:27017/shop';
      await mongoose.connect(mongoUri);
    }

    const testSchema = new Schema<ITestCustomerRecord>({
      customerRef: { type: String, required: true },
      phone: { type: String, required: true },
      shippingAddress: {
        line1: { type: String, required: true },
        city: { type: String, required: true },
      },
      savedAddresses: [
        {
          line1: { type: String, required: true },
          city: { type: String, required: true },
        },
      ],
      status: { type: String, default: 'active' },
    });

    // Apply plugin targeting phone, shippingAddress.line1, and savedAddresses.line1
    // city, status, and customerRef are deliberately left unencrypted
    testSchema.plugin(encryptedFieldsPlugin, {
      fields: ['phone', 'shippingAddress.line1', 'savedAddresses.line1'],
    });

    TestModel = mongoose.model<ITestCustomerRecord>(modelName, testSchema);
  });

  afterAll(async () => {
    if (TestModel) {
      await TestModel.collection.drop().catch(() => {});
    }
  });

  it('encrypts targeted fields in raw MongoDB collection while keeping doc API and toJSON in plaintext', async () => {
    const doc = await TestModel.create({
      customerRef: 'CUST-001',
      phone: '+94771234567',
      shippingAddress: {
        line1: '123 Galle Road',
        city: 'Colombo',
      },
      savedAddresses: [
        { line1: '45 Lake View', city: 'Kandy' },
        { line1: '78 Hill Top', city: 'Nuwara Eliya' },
      ],
      status: 'active',
    });

    // Verify raw MongoDB document in database
    const raw = await mongoose.connection.collection(TestModel.collection.name).findOne({ _id: doc._id });
    expect(raw).toBeDefined();

    // Sensitive fields are encrypted in raw storage
    expect(raw?.phone.startsWith('enc:v')).toBe(true);
    expect(raw?.shippingAddress.line1.startsWith('enc:v')).toBe(true);
    expect(raw?.savedAddresses[0].line1.startsWith('enc:v')).toBe(true);
    expect(raw?.savedAddresses[1].line1.startsWith('enc:v')).toBe(true);

    // Plaintext exclusions remain unencrypted in raw storage
    expect(raw?.customerRef).toBe('CUST-001');
    expect(raw?.shippingAddress.city).toBe('Colombo');
    expect(raw?.savedAddresses[0].city).toBe('Kandy');
    expect(raw?.savedAddresses[1].city).toBe('Nuwara Eliya');
    expect(raw?.status).toBe('active');

    // Document in-memory and toJSON() return decrypted plaintext
    expect(doc.phone).toBe('+94771234567');
    expect(doc.shippingAddress.line1).toBe('123 Galle Road');
    expect(doc.shippingAddress.city).toBe('Colombo');
    expect(doc.savedAddresses?.[0].line1).toBe('45 Lake View');

    const json = doc.toJSON();
    expect(json.phone).toBe('+94771234567');
    expect(json.shippingAddress.line1).toBe('123 Galle Road');
  });

  it('transparently decrypts documents on find and findById', async () => {
    const doc = await TestModel.create({
      customerRef: 'CUST-002',
      phone: '+94779998877',
      shippingAddress: {
        line1: '99 Temple Road',
        city: 'Galle',
      },
    });

    const found = await TestModel.findById(doc._id);
    expect(found).toBeDefined();
    expect(found?.phone).toBe('+94779998877');
    expect(found?.shippingAddress.line1).toBe('99 Temple Road');
    expect(found?.shippingAddress.city).toBe('Galle');
  });

  it('encrypts fields updated via doc.save()', async () => {
    const doc = await TestModel.create({
      customerRef: 'CUST-003',
      phone: '+94771112222',
      shippingAddress: {
        line1: 'Original Address',
        city: 'Jaffna',
      },
    });

    doc.phone = '+94773334444';
    doc.shippingAddress.line1 = 'Updated Address';
    await doc.save();

    // Check raw storage
    const raw = await mongoose.connection.collection(TestModel.collection.name).findOne({ _id: doc._id });
    expect(raw?.phone.startsWith('enc:v')).toBe(true);
    expect(raw?.shippingAddress.line1.startsWith('enc:v')).toBe(true);

    // Check decrypted values
    expect(doc.phone).toBe('+94773334444');
    expect(doc.shippingAddress.line1).toBe('Updated Address');
  });

  it('encrypts fields updated via findOneAndUpdate with $set', async () => {
    const doc = await TestModel.create({
      customerRef: 'CUST-004',
      phone: '+94775556666',
      shippingAddress: {
        line1: 'Initial Street',
        city: 'Negombo',
      },
    });

    const updated = await TestModel.findOneAndUpdate(
      { _id: doc._id },
      {
        $set: {
          phone: '+94777778888',
          'shippingAddress.line1': 'Dotted New Street',
        },
      },
      { new: true }
    );

    expect(updated).toBeDefined();
    expect(updated?.phone).toBe('+94777778888');
    expect(updated?.shippingAddress.line1).toBe('Dotted New Street');

    // Confirm raw storage holds encrypted values
    const raw = await mongoose.connection.collection(TestModel.collection.name).findOne({ _id: doc._id });
    expect(raw?.phone.startsWith('enc:v')).toBe(true);
    expect(raw?.shippingAddress.line1.startsWith('enc:v')).toBe(true);
  });

  it('encrypts documents created via insertMany', async () => {
    const inserted = await TestModel.insertMany([
      {
        customerRef: 'BULK-01',
        phone: '+94770000001',
        shippingAddress: { line1: 'Bulk 1', city: 'Matara' },
      },
      {
        customerRef: 'BULK-02',
        phone: '+94770000002',
        shippingAddress: { line1: 'Bulk 2', city: 'Kurunegala' },
      },
    ]);

    expect(inserted.length).toBe(2);

    for (const item of inserted) {
      const raw = await mongoose.connection.collection(TestModel.collection.name).findOne({ _id: item._id });
      expect(raw?.phone.startsWith('enc:v')).toBe(true);
      expect(raw?.shippingAddress.line1.startsWith('enc:v')).toBe(true);
      expect(raw?.shippingAddress.city).toBeDefined();
      expect(raw?.shippingAddress.city.startsWith('enc:v')).toBe(false);
    }
  });

  it('seamlessly loads legacy unencrypted documents from database without failing', async () => {
    const legacyDocId = new mongoose.Types.ObjectId();
    await mongoose.connection.collection(TestModel.collection.name).insertOne({
      _id: legacyDocId,
      customerRef: 'LEGACY-01',
      phone: '0712345678', // Plaintext legacy phone
      shippingAddress: {
        line1: 'Old Unencrypted Road', // Plaintext legacy address
        city: 'Badulla',
      },
      status: 'active',
    });

    const loaded = await TestModel.findById(legacyDocId);
    expect(loaded).toBeDefined();
    expect(loaded?.phone).toBe('0712345678');
    expect(loaded?.shippingAddress.line1).toBe('Old Unencrypted Road');
    expect(loaded?.shippingAddress.city).toBe('Badulla');
  });
});

describe('HIPAA01: Environment Configuration & Keyring Validation (env.ts)', () => {
  const validKey32Bytes = crypto.randomBytes(32).toString('base64');
  const validKey2_32Bytes = crypto.randomBytes(32).toString('base64');

  it('parses valid comma-separated and JSON keyrings correctly', () => {
    const csvRing = parseKeyRing(`v1:${validKey32Bytes},v2:${validKey2_32Bytes}`);
    expect(csvRing.has('1')).toBe(true);
    expect(csvRing.has('v1')).toBe(true);
    expect(csvRing.has('2')).toBe(true);
    expect(csvRing.has('v2')).toBe(true);
    expect(csvRing.get('1')?.length).toBe(32);

    const jsonRing = parseKeyRing(JSON.stringify({ v1: validKey32Bytes, v2: validKey2_32Bytes }));
    expect(jsonRing.has('1')).toBe(true);
    expect(jsonRing.has('v2')).toBe(true);
  });

  it('fails production environment validation when FIELD_ENCRYPTION_KEYS is missing', () => {
    const prodEnvMissingKeys = {
      NODE_ENV: 'production',
      JWT_SECRET: 'super-secure-production-jwt-secret-min-32-chars-long',
      MONGO_URI: 'mongodb://localhost:27017/prod_shop',
      COOKIE_SECURE: true,
      COOKIE_SAMESITE: 'strict',
      PAYMENT_SIMULATOR_ENABLED: false,
    };

    const parsed = envSchema.safeParse(prodEnvMissingKeys);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issuePaths = parsed.error.issues.map((i) => i.path.join('.'));
      expect(issuePaths).toContain('FIELD_ENCRYPTION_KEYS');
      const keysIssue = parsed.error.issues.find((i) => i.path.includes('FIELD_ENCRYPTION_KEYS'));
      expect(keysIssue?.message).toMatch(/FIELD_ENCRYPTION_KEYS is required in production/i);
    }
  });

  it('fails validation when FIELD_ENCRYPTION_KEYS contains invalid key lengths', () => {
    const invalidKeyShort = Buffer.from('too-short-16byte').toString('base64');
    const envWithShortKey = {
      NODE_ENV: 'development',
      FIELD_ENCRYPTION_KEYS: `v1:${invalidKeyShort}`,
    };

    const parsed = envSchema.safeParse(envWithShortKey);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issuePaths = parsed.error.issues.map((i) => i.path.join('.'));
      expect(issuePaths).toContain('FIELD_ENCRYPTION_KEYS');
    }
  });

  it('fails validation when FIELD_ENCRYPTION_ACTIVE_VERSION does not exist in key ring', () => {
    const prodEnvMismatchVersion = {
      NODE_ENV: 'production',
      JWT_SECRET: 'super-secure-production-jwt-secret-min-32-chars-long',
      MONGO_URI: 'mongodb://localhost:27017/prod_shop',
      COOKIE_SECURE: true,
      COOKIE_SAMESITE: 'strict',
      PAYMENT_SIMULATOR_ENABLED: false,
      FIELD_ENCRYPTION_KEYS: `v1:${validKey32Bytes}`,
      FIELD_ENCRYPTION_ACTIVE_VERSION: 'v3', // v3 does not exist in FIELD_ENCRYPTION_KEYS
    };

    const parsed = envSchema.safeParse(prodEnvMismatchVersion);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issuePaths = parsed.error.issues.map((i) => i.path.join('.'));
      expect(issuePaths).toContain('FIELD_ENCRYPTION_ACTIVE_VERSION');
      const versionIssue = parsed.error.issues.find((i) => i.path.includes('FIELD_ENCRYPTION_ACTIVE_VERSION'));
      expect(versionIssue?.message).toMatch(/must match a key defined in FIELD_ENCRYPTION_KEYS/i);
    }
  });

  it('succeeds with valid keys and matching active version in production', () => {
    const validProdEnv = {
      NODE_ENV: 'production',
      JWT_SECRET: 'super-secure-production-jwt-secret-min-32-chars-long',
      MONGO_URI: 'mongodb://localhost:27017/prod_shop',
      COOKIE_SECURE: true,
      COOKIE_SAMESITE: 'strict',
      PAYMENT_SIMULATOR_ENABLED: false,
      FIELD_ENCRYPTION_KEYS: `v1:${validKey32Bytes},v2:${validKey2_32Bytes}`,
      FIELD_ENCRYPTION_ACTIVE_VERSION: 'v2',
    };

    const parsed = envSchema.safeParse(validProdEnv);
    expect(parsed.success).toBe(true);
  });
});
