/**
 * Environment variable validation
 * Ensures required configuration is present before app starts
 */

interface EnvVar {
  name: string
  required: boolean
  description: string
  validate?: (value: string) => boolean | string
}

const envVars: EnvVar[] = [
  {
    name: 'POSTGRES_PRISMA_URL',
    required: true,
    description: 'PostgreSQL connection string (pooled) for Vercel Postgres',
    validate: (v) => v.startsWith('postgresql://') || 'Must be a valid PostgreSQL connection string'
  },
  {
    name: 'NEXT_PUBLIC_EVM_RPC',
    required: false,
    description: 'EVM RPC endpoint URL',
    validate: (v) => v.startsWith('http') || 'Must be a valid HTTP/HTTPS URL'
  },
  {
    name: 'API_AUTH_TOKEN',
    required: false,
    description: 'API key for write operations (recommended in production)',
  },
  {
    name: 'ADMIN_SECRET',
    required: false,
    description: 'Secret for admin operations (required for DELETE endpoints)',
  }
]

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const envVar of envVars) {
    const value = process.env[envVar.name]

    if (envVar.required && !value) {
      errors.push(`Required environment variable ${envVar.name} is not set. ${envVar.description}`)
      continue
    }

    if (value && envVar.validate) {
      const validationResult = envVar.validate(value)
      if (validationResult !== true) {
        const errorMsg = typeof validationResult === 'string' 
          ? validationResult 
          : `Invalid format for ${envVar.name}`
        if (envVar.required) {
          errors.push(`${envVar.name}: ${errorMsg}`)
        } else {
          warnings.push(`${envVar.name}: ${errorMsg}`)
        }
      }
    }

    // Check for exposed private keys
    if (envVar.name.includes('PRIVATE_KEY') && envVar.name.startsWith('NEXT_PUBLIC_')) {
      errors.push(
        `SECURITY: ${envVar.name} uses NEXT_PUBLIC_ prefix which exposes it to the browser. ` +
        `Private keys should NEVER be exposed. Remove NEXT_PUBLIC_ prefix and use server-side only.`
      )
    }
  }

  // Check for hardcoded API keys in code (would need to be done at build time)
  // This is a runtime check, so we warn about common issues

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.POSTGRES_PRISMA_URL) {
      errors.push(
        'POSTGRES_PRISMA_URL is required in production. SQLite is not suitable for production.'
      )
    }

    if (!process.env.API_AUTH_TOKEN) {
      warnings.push(
        'API_AUTH_TOKEN is not set. Write operations will be unprotected in production.'
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate and throw if invalid (for startup)
 */
export function requireValidEnvironment(): void {
  const result = validateEnvironment()
  
  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment validation warnings:')
    result.warnings.forEach(w => console.warn(`  - ${w}`))
  }

  if (!result.isValid) {
    console.error('❌ Environment validation failed:')
    result.errors.forEach(e => console.error(`  - ${e}`))
    throw new Error('Environment validation failed. Please fix the errors above.')
  }

  console.log('✅ Environment validation passed')
}




