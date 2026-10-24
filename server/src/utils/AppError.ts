export class AppError extends Error {
  statusCode: number;
  code?: string;
  isOperational: boolean;
  errors?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    codeOrErrors?: string | any,
    errors?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    if (typeof codeOrErrors === 'string') {
      this.code = codeOrErrors;
      this.errors = errors;
    } else if (codeOrErrors !== undefined) {
      this.errors = codeOrErrors;
      this.code = typeof errors === 'string' ? errors : undefined;
    }

    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
