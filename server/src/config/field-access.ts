export type FieldPermission = 'FULL' | 'MASKED' | 'HIDDEN' | 'CONDITIONAL';

export interface FieldPolicyRule {
  customerOwn: FieldPermission;
  staff: FieldPermission;
  deliveryManager: FieldPermission;
  admin: FieldPermission;
  owner: FieldPermission;
  supplier: FieldPermission;
  description: string;
}

export const ACTIVE_DELIVERY_STATUSES = ['picked_up', 'in_transit', 'out_for_delivery'] as const;
export const ACTIVE_RETURN_PICKUP_STATUSES = ['pickup_scheduled', 'picked_up'] as const;

export const FIELD_ACCESS_POLICIES: Record<string, Record<string, FieldPolicyRule>> = {
  Order: {
    'user.name': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'FULL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Recipient/customer legal or display name',
    },
    'user.email': {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Account login and order communication email',
    },
    'user.phone': {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'CONDITIONAL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Customer contact phone number',
    },
    'shippingAddress.line1': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'CONDITIONAL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Primary street address and building number',
    },
    'shippingAddress.line2': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'CONDITIONAL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Apartment, suite, or unit details',
    },
    'shippingAddress.city': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'FULL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Destination city / municipality',
    },
    'shippingAddress.postalCode': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'FULL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Postal/ZIP routing code',
    },
    'shippingAddress.phone': {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'CONDITIONAL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Recipient delivery contact phone',
    },
  },
  Invoice: {
    'user.name': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Customer billing name',
    },
    'user.email': {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Customer billing email',
    },
    'shippingAddress.line1': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Billing delivery street address',
    },
    'shippingAddress.line2': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Billing delivery suite/unit',
    },
    'shippingAddress.city': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Billing delivery city',
    },
    'shippingAddress.postalCode': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Billing postal code',
    },
    'shippingAddress.phone': {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Billing contact phone',
    },
  },
  ReturnRequest: {
    'user.name': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'FULL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Returning customer name',
    },
    'user.email': {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Returning customer email',
    },
    'pickup.address': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'CONDITIONAL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Physical pickup address for courier return collection',
    },
    'pickup.phone': {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'CONDITIONAL',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Contact phone for return handover',
    },
  },
  User: {
    name: {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Customer profile full name',
    },
    email: {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Primary customer account email',
    },
    'addresses[].line1': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Saved address street lines',
    },
    'addresses[].line2': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Saved address apartment/unit',
    },
    'addresses[].city': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Saved address city',
    },
    'addresses[].postalCode': {
      customerOwn: 'FULL',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Saved address postal routing code',
    },
    'addresses[].phone': {
      customerOwn: 'FULL',
      staff: 'MASKED',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'HIDDEN',
      description: 'Saved address contact phone',
    },
  },
  Supplier: {
    name: {
      customerOwn: 'HIDDEN',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'FULL',
      description: 'Vendor registered company name',
    },
    contactPerson: {
      customerOwn: 'HIDDEN',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'FULL',
      description: 'Vendor primary representative name',
    },
    email: {
      customerOwn: 'HIDDEN',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'FULL',
      description: 'Vendor commercial contact email',
    },
    phone: {
      customerOwn: 'HIDDEN',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'FULL',
      description: 'Vendor direct phone number',
    },
    address: {
      customerOwn: 'HIDDEN',
      staff: 'FULL',
      deliveryManager: 'HIDDEN',
      admin: 'FULL',
      owner: 'FULL',
      supplier: 'FULL',
      description: 'Vendor operating / warehouse address',
    },
  },
};

/**
 * Generates the standardized markdown table for docs/FIELD_ACCESS_MATRIX.md.
 * Used by automated tests to ensure documentation stays perfectly in sync with code.
 */
export function generateFieldAccessMatrixMarkdown(): string {
  const lines: string[] = [
    '# Role-Based Field Access Control Matrix',
    '',
    'This document records the definitive field-level access control permissions across Larvo models and roles.',
    'It is programmatically validated against `server/src/config/field-access.ts` to prevent policy drift.',
    '',
    '## Legend',
    '- **FULL**: Plaintext value returned without redaction.',
    '- **MASKED**: Partially redacted for operational reference (e.g. phone trailing 3 digits `*******678`, email `c***@example.com`).',
    '- **HIDDEN**: Field omitted or explicitly nullified in the response.',
    '- **CONDITIONAL**: Granted `FULL` only during active fulfillment/pickup states (`picked_up`, `in_transit`, `out_for_delivery`, `pickup_scheduled`), otherwise `HIDDEN` or city-only.',
    '',
  ];

  for (const [entity, fields] of Object.entries(FIELD_ACCESS_POLICIES)) {
    lines.push(`### ${entity}`);
    lines.push('');
    lines.push(
      '| Field | Customer (Own) | Staff | Delivery Manager | Admin | Owner | Supplier | Purpose / Description |'
    );
    lines.push(
      '| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |'
    );

    for (const [fieldName, rule] of Object.entries(fields)) {
      lines.push(
        `| \`${fieldName}\` | ${rule.customerOwn} | ${rule.staff} | ${rule.deliveryManager} | ${rule.admin} | ${rule.owner} | ${rule.supplier} | ${rule.description} |`
      );
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Audit Logging of PII Reads');
  lines.push('');
  lines.push('Whenever a privileged actor (`staff`, `admin`, `owner`, `delivery_manager`) reads another person’s full personal data (e.g. street address `line1`, `line2`, or full `phone`), an immutable audit log entry is written:');
  lines.push('- **Action**: `PII_READ`');
  lines.push('- **Actor**: Derives caller `userId`, `role`, `ip`, `userAgent`, and `requestId`.');
  lines.push('- **Metadata**: Contains `{ fields: [string], viewerRole: string }`.');
  lines.push('- **Zero Sensitive Data**: Raw personal values are NEVER stored in audit logs or server logs.');
  lines.push('- **Customer Exemption**: Customers inspecting their own orders, invoices, returns, or profile are never audited.');
  lines.push('');

  return lines.join('\n');
}
