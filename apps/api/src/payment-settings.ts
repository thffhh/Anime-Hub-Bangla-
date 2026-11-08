// Public recipient numbers, not merchant secrets. An empty value disables the method.
export const isBangladeshMobileNumber = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:01|\+8801)[3-9]\d{8}$/.test(value);
