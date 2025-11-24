// Environment variable validation for critical payment and billing systems

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePaymentEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const isDevelopment = process.env.NEXT_PUBLIC_APP_MODE === 'development';
  const isProduction = !isDevelopment;

  // Core Supabase requirements (only required in production mode)
  if (!isDevelopment) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
    }
  }

  // Production-only requirements
  if (isProduction) {
    // Polar requirements
    if (!process.env.POLAR_ACCESS_TOKEN) {
      errors.push('POLAR_ACCESS_TOKEN is required in production');
    }
    if (!process.env.POLAR_WEBHOOK_SECRET) {
      errors.push('POLAR_WEBHOOK_SECRET is required in production');
    }
    if (!process.env.POLAR_UNLIMITED_PRODUCT_ID) {
      errors.push('POLAR_UNLIMITED_PRODUCT_ID is required in production');
    }
    if (!process.env.POLAR_PAY_PER_USE_PRODUCT_ID) {
      errors.push('POLAR_PAY_PER_USE_PRODUCT_ID is required in production');
    }
    
    // API keys for usage tracking
    if (!process.env.VALYU_API_KEY) {
      warnings.push('VALYU_API_KEY missing - patent search will fail');
    }
    if (!process.env.DAYTONA_API_KEY) {
      warnings.push('DAYTONA_API_KEY missing - code execution will fail');
    }
    // Vercel AI Gateway is required (per task requirements)
    if (!process.env.AI_GATEWAY_API_KEY) {
      errors.push('AI_GATEWAY_API_KEY is required - get your key at https://vercel.com/dashboard > AI Gateway > API Keys');
    }
  }

  // Development mode - AI Gateway still recommended but not strictly required
  if (isDevelopment && !process.env.AI_GATEWAY_API_KEY) {
    warnings.push('AI_GATEWAY_API_KEY missing - recommended for Vercel AI SDK integration');
  }

  // Validate URL formats
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function logEnvironmentStatus(): void {
  const appMode = process.env.NEXT_PUBLIC_APP_MODE;
  const isDevelopment = appMode === 'development';
  
  // Skip validation in development mode
  if (isDevelopment) {
    console.log('[Env] Development mode detected - skipping Supabase/Polar validation');
    return;
  }
  
  const validation = validatePaymentEnvironment();
  
  if (validation.valid) {
  } else {
    validation.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
}

// Auto-validate on import in production (only if not in development mode)
if (process.env.NEXT_PUBLIC_APP_MODE !== 'development') {
  const validation = validatePaymentEnvironment();
  if (!validation.valid) {
    validation.errors.forEach(error => console.error(`  - ${error}`));
    // Don't throw in production to avoid complete app failure, but log critically
  }
}