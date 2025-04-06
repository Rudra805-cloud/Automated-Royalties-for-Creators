#![allow(non_snake_case)]
#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, 
    log, Env, Symbol, String, symbol_short, 
    Address, Vec, U256
};

// Token amount with clear decimal representation
type TokenAmount = U256;

// Structure for storing work metadata
#[contracttype]
#[derive(Clone)]
pub struct CreativeWork {
    pub work_id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub creation_time: u64,
    pub content_type: String,  // "image", "music", "text", etc.
    pub is_active: bool,
    pub license_count: u64,    // Number of licenses issued
}

// Structure for defining royalty rules
#[contracttype]
#[derive(Clone)]
pub struct RoyaltyConfig {
    pub work_id: u64,
    pub primary_sale_percentage: u32,  // Stored as basis points (e.g., 1000 = 10%)
    pub secondary_sale_percentage: u32,
    pub streaming_rate: TokenAmount,    // Per-stream payment amount
    pub minimum_license_fee: TokenAmount,
}

// Structure for license details
#[contracttype]
#[derive(Clone)]
pub struct License {
    pub license_id: u64,
    pub work_id: u64,
    pub licensee: Address,
    pub license_type: String,  // "commercial", "personal", "limited", etc.
    pub issue_time: u64,
    pub expiration_time: u64,  // 0 for perpetual
    pub payment_amount: TokenAmount,
}

// Structure for tracking royalty payments
#[contracttype]
#[derive(Clone)]
pub struct RoyaltyPayment {
    pub payment_id: u64,
    pub work_id: u64,
    pub payer: Address,
    pub payment_time: u64,
    pub payment_amount: TokenAmount,
    pub payment_type: String,  // "license", "sale", "streaming", etc.
}

// Statistics for royalty system
#[contracttype]
#[derive(Clone)]
pub struct RoyaltyStats {
    pub total_works: u64,
    pub total_licenses: u64,
    pub total_payments: u64,
    pub total_revenue: TokenAmount,
}

// Enums for storage keys
#[contracttype]
pub enum WorkKey {
    CreativeWork(u64),
}

#[contracttype]
pub enum RoyaltyKey {
    Config(u64),
}

#[contracttype]
pub enum LicenseKey {
    License(u64),
}

#[contracttype]
pub enum PaymentKey {
    Payment(u64),
}

// Constants for storage keys
const WORK_COUNT: Symbol = symbol_short!("W_COUNT");
const LICENSE_COUNT: Symbol = symbol_short!("L_COUNT");
const PAYMENT_COUNT: Symbol = symbol_short!("P_COUNT");
const ROYALTY_STATS: Symbol = symbol_short!("R_STATS");
const CREATOR_WORKS: Symbol = symbol_short!("C_WORKS");

#[contract]
pub struct RoyaltyContract;

#[contractimpl]
impl RoyaltyContract {
    // Function to register a new creative work
    pub fn register_work(
        env: Env, 
        creator: Address, 
        title: String, 
        description: String, 
        content_type: String,
        primary_sale_percentage: u32,
        secondary_sale_percentage: u32,
        streaming_rate: TokenAmount,
        minimum_license_fee: TokenAmount
    ) -> u64 {
        // Authenticate creator
        creator.require_auth();
        
        // Ensure percentages are within valid range (0-10000 basis points, representing 0-100%)
        if primary_sale_percentage > 10000 || secondary_sale_percentage > 10000 {
            log!(&env, "Invalid royalty percentage values. Must be between 0-10000 basis points");
            panic!("Invalid royalty percentage values");
        }
        
        // Get current work count
        let mut work_count: u64 = env.storage().instance().get(&WORK_COUNT).unwrap_or(0);
        work_count += 1;
        
        // Create new work
        let current_time = env.ledger().timestamp();
        let work = CreativeWork {
            work_id: work_count,
            creator: creator.clone(),
            title,
            description,
            creation_time: current_time,
            content_type,
            is_active: true,
            license_count: 0,
        };
        
        // Create royalty configuration
        let royalty_config = RoyaltyConfig {
            work_id: work_count,
            primary_sale_percentage,
            secondary_sale_percentage,
            streaming_rate,
            minimum_license_fee,
        };
        
        // Update creator's works list
        let mut creator_works: Vec<u64> = env.storage().instance().get(&(CREATOR_WORKS, &creator)).unwrap_or(Vec::new(&env));
        creator_works.push_back(work_count);
        
        // Update storage
        env.storage().instance().set(&WorkKey::CreativeWork(work_count), &work);
        env.storage().instance().set(&RoyaltyKey::Config(work_count), &royalty_config);
        env.storage().instance().set(&WORK_COUNT, &work_count);
        env.storage().instance().set(&(CREATOR_WORKS, &creator), &creator_works);
        
        // Update stats
        let mut stats = Self::get_royalty_stats(env.clone());
        stats.total_works += 1;
        env.storage().instance().set(&ROYALTY_STATS, &stats);
        
        // Extend contract data lifetime
        env.storage().instance().extend_ttl(5000, 5000);
        
        log!(&env, "Registered work ID: {}", work_count);
        work_count
    }
    
    // Purchase a license for a creative work
    pub fn purchase_license(
        env: Env,
        work_id: u64,
        licensee: Address,
        license_type: String,
        duration_seconds: u64,  // 0 for perpetual
        payment_amount: TokenAmount
    ) -> u64 {
        // Authenticate licensee
        licensee.require_auth();
        
        // Verify work exists and is active
        let mut work = Self::get_work(env.clone(), work_id);
        if !work.is_active {
            log!(&env, "Work is not active");
            panic!("Work is not available for licensing");
        }
        
        // Get royalty configuration
        let config = Self::get_royalty_config(env.clone(), work_id);
        
        // Verify payment amount meets minimum
        if payment_amount < config.minimum_license_fee {
            log!(&env, "Payment amount below minimum license fee");
            panic!("Payment too low for license");
        }
        
        // Generate new license ID
        let mut license_count: u64 = env.storage().instance().get(&LICENSE_COUNT).unwrap_or(0);
        license_count += 1;
        
        // Create license
        let current_time = env.ledger().timestamp();
        let expiration_time = if duration_seconds == 0 { 0 } else { current_time + duration_seconds };
        
        let license = License {
            license_id: license_count,
            work_id,
            licensee: licensee.clone(),
            license_type,
            issue_time: current_time,
            expiration_time,
            payment_amount: payment_amount.clone(),
        };
        
        // Record payment
        let payment_id = Self::record_payment(
            env.clone(),
            work_id,
            licensee.clone(),
            payment_amount.clone(),
            String::from_str(&env, "license")
        );
        
        // Update work license count
        work.license_count += 1;
        
        // Update storage
        env.storage().instance().set(&WorkKey::CreativeWork(work_id), &work);
        env.storage().instance().set(&LicenseKey::License(license_count), &license);
        env.storage().instance().set(&LICENSE_COUNT, &license_count);
        
        // Update stats
        let mut stats = Self::get_royalty_stats(env.clone());
        stats.total_licenses += 1;
        env.storage().instance().set(&ROYALTY_STATS, &stats);
        
        // Extend contract data lifetime
        env.storage().instance().extend_ttl(5000, 5000);
        
        log!(&env, "License purchased - ID: {}, Work: {}, Payment: {}", license_count, work_id, payment_id);
        license_count
    }
    
    // Record payment for streaming, sales, or other usage
    pub fn record_payment(
        env: Env,
        work_id: u64,
        payer: Address,
        payment_amount: TokenAmount,
        payment_type: String
    ) -> u64 {
        // Verify work exists
        let work = Self::get_work(env.clone(), work_id);
        
        // Generate payment ID
        let mut payment_count: u64 = env.storage().instance().get(&PAYMENT_COUNT).unwrap_or(0);
        payment_count += 1;
        
        // Create payment record
        let payment = RoyaltyPayment {
            payment_id: payment_count,
            work_id,
            payer,
            payment_time: env.ledger().timestamp(),
            payment_amount: payment_amount.clone(),
            payment_type,
        };
        
        // Update storage
        env.storage().instance().set(&PaymentKey::Payment(payment_count), &payment);
        env.storage().instance().set(&PAYMENT_COUNT, &payment_count);
        
        // Update stats
        let mut stats = Self::get_royalty_stats(env.clone());
        stats.total_payments += 1;
        // Fixed: Use proper U256 addition method instead of + operator
        stats.total_revenue = stats.total_revenue.add(&payment_amount);
        env.storage().instance().set(&ROYALTY_STATS, &stats);
        
        // Extend contract data lifetime
        env.storage().instance().extend_ttl(5000, 5000);
        
        log!(&env, "Payment recorded - ID: {}, Work: {}", payment_count, work_id);
        payment_count
    }
    
    // Update royalty configuration for a work
    pub fn update_royalty_config(
        env: Env,
        work_id: u64,
        creator: Address,
        primary_sale_percentage: u32,
        secondary_sale_percentage: u32,
        streaming_rate: TokenAmount,
        minimum_license_fee: TokenAmount
    ) {
        // Authenticate creator
        creator.require_auth();
        
        // Verify work exists and caller is creator
        let work = Self::get_work(env.clone(), work_id);
        if work.creator != creator {
            log!(&env, "Only the creator can update royalty configuration");
            panic!("Not authorized to update this work");
        }
        
        // Ensure percentages are within valid range
        if primary_sale_percentage > 10000 || secondary_sale_percentage > 10000 {
            log!(&env, "Invalid royalty percentage values. Must be between 0-10000 basis points");
            panic!("Invalid royalty percentage values");
        }
        
        // Create updated royalty configuration
        let royalty_config = RoyaltyConfig {
            work_id,
            primary_sale_percentage,
            secondary_sale_percentage,
            streaming_rate,
            minimum_license_fee,
        };
        
        // Update storage
        env.storage().instance().set(&RoyaltyKey::Config(work_id), &royalty_config);
        
        // Extend contract data lifetime
        env.storage().instance().extend_ttl(5000, 5000);
        
        log!(&env, "Updated royalty config for work: {}", work_id);
    }
    
    // Deactivate a work (no longer available for licensing)
    pub fn deactivate_work(env: Env, work_id: u64, creator: Address) {
        // Authenticate creator
        creator.require_auth();
        
        // Verify work exists and caller is creator
        let mut work = Self::get_work(env.clone(), work_id);
        if work.creator != creator {
            log!(&env, "Only the creator can deactivate a work");
            panic!("Not authorized to deactivate this work");
        }
        
        // Deactivate work
        work.is_active = false;
        
        // Update storage
        env.storage().instance().set(&WorkKey::CreativeWork(work_id), &work);
        
        // Extend contract data lifetime
        env.storage().instance().extend_ttl(5000, 5000);
        
        log!(&env, "Deactivated work: {}", work_id);
    }
    
    // Reactivate a previously deactivated work
    pub fn reactivate_work(env: Env, work_id: u64, creator: Address) {
        // Authenticate creator
        creator.require_auth();
        
        // Verify work exists and caller is creator
        let mut work = Self::get_work(env.clone(), work_id);
        if work.creator != creator {
            log!(&env, "Only the creator can reactivate a work");
            panic!("Not authorized to reactivate this work");
        }
        
        // Reactivate work
        work.is_active = true;
        
        // Update storage
        env.storage().instance().set(&WorkKey::CreativeWork(work_id), &work);
        
        // Extend contract data lifetime
        env.storage().instance().extend_ttl(5000, 5000);
        
        log!(&env, "Reactivated work: {}", work_id);
    }
    
    // Get creator's works
    pub fn get_creator_works(env: Env, creator: Address) -> Vec<u64> {
        env.storage().instance().get(&(CREATOR_WORKS, &creator)).unwrap_or(Vec::new(&env))
    }
    
    // Get work details
    pub fn get_work(env: Env, work_id: u64) -> CreativeWork {
        env.storage().instance().get(&WorkKey::CreativeWork(work_id))
            .unwrap_or_else(|| {
                log!(&env, "Work not found: {}", work_id);
                panic!("Work does not exist");
            })
    }
    
    // Get royalty configuration
    pub fn get_royalty_config(env: Env, work_id: u64) -> RoyaltyConfig {
        env.storage().instance().get(&RoyaltyKey::Config(work_id))
            .unwrap_or_else(|| {
                log!(&env, "Royalty config not found for work: {}", work_id);
                panic!("Royalty configuration does not exist");
            })
    }
    
    // Get license details
    pub fn get_license(env: Env, license_id: u64) -> License {
        env.storage().instance().get(&LicenseKey::License(license_id))
            .unwrap_or_else(|| {
                log!(&env, "License not found: {}", license_id);
                panic!("License does not exist");
            })
    }
    
    // Get payment details
    pub fn get_payment(env: Env, payment_id: u64) -> RoyaltyPayment {
        env.storage().instance().get(&PaymentKey::Payment(payment_id))
            .unwrap_or_else(|| {
                log!(&env, "Payment not found: {}", payment_id);
                panic!("Payment does not exist");
            })
    }
    
    // Get system statistics
    pub fn get_royalty_stats(env: Env) -> RoyaltyStats {
        env.storage().instance().get(&ROYALTY_STATS).unwrap_or(RoyaltyStats {
            total_works: 0,
            total_licenses: 0,
            total_payments: 0,
            total_revenue: U256::from_u32(&env, 0),
        })
    }
    
    // Check if a license is valid
    pub fn verify_license(env: Env, license_id: u64) -> bool {
        // Fixed: Added type annotation to resolve type inference issue
        match env.storage().instance().get::<LicenseKey, License>(&LicenseKey::License(license_id)) {
            Some(license) => {
                let current_time = env.ledger().timestamp();
                // License is valid if it's perpetual (expiration_time = 0) or not expired
                license.expiration_time == 0 || current_time < license.expiration_time
            },
            None => false,
        }
    }
    
    // Get all licenses for a specific work
    pub fn get_work_licenses(env: Env, work_id: u64) -> Vec<u64> {
        let license_count: u64 = env.storage().instance().get(&LICENSE_COUNT).unwrap_or(0);
        let mut licenses = Vec::new(&env);
        
        for i in 1..=license_count {
            // Fixed: Added type annotation to resolve type inference issue
            if let Some(license) = env.storage().instance().get::<LicenseKey, License>(&LicenseKey::License(i)) {
                if license.work_id == work_id {
                    licenses.push_back(license.license_id);
                }
            }
        }
        
        licenses
    }
    
    // Get all payments for a specific work
    pub fn get_work_payments(env: Env, work_id: u64) -> Vec<u64> {
        let payment_count: u64 = env.storage().instance().get(&PAYMENT_COUNT).unwrap_or(0);
        let mut payments = Vec::new(&env);
        
        for i in 1..=payment_count {
            // Fixed: Added type annotation to resolve type inference issue
            if let Some(payment) = env.storage().instance().get::<PaymentKey, RoyaltyPayment>(&PaymentKey::Payment(i)) {
                if payment.work_id == work_id {
                    payments.push_back(payment.payment_id);
                }
            }
        }
        
        payments
    }
}