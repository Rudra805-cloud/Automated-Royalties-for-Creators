// Soroban Client for interacting with the Royalty Contract

// Export the class directly
export class SorobanClient {
    constructor() {
        // Contract ID from the deployed Soroban contract
        this.contractId = "CBZVR4C4WUVFLFHU2T2IOCYGWGSQFZNPQJ7QJYMSCLP7JT6GYO224GAF";
        
        // Default to testnet
        this.networkPassphrase = StellarSdk.Networks.TESTNET;
        this.rpcUrl = "https://soroban-testnet.stellar.org";
        
        // Will store the user's keypair after connecting
        this.userKeypair = null;
        this.userAddress = null;
        
        // Initialize server when the SDK is available
        this.server = null;
        this.initServer();

        // Check for Freighter with retries
        this.checkForFreighter(10); // Try up to 10 times
    }

    // Initialize the server connection
    initServer() {
        try {
            if (typeof StellarSdk !== 'undefined') {
                this.server = new StellarSdk.SorobanRpc.Server(this.rpcUrl);
                console.log("Soroban RPC server initialized");
            } else {
                console.warn("StellarSdk not loaded yet, retrying in 1 second");
                setTimeout(() => this.initServer(), 1000);
            }
        } catch (error) {
            console.error("Failed to initialize Soroban server:", error);
        }
    }

    // Improved isFreighterAvailable method
    isFreighterAvailable() {
        // Check multiple paths
        const freighter = window.freighter || (window.stellar && window.stellar.freighter);
        return freighter && typeof freighter.isConnected === 'function';
    }

    // Add this method to initialize after Freighter becomes available
    initializeWithFreighter() {
        if (this.isFreighterAvailable()) {
            console.log("Freighter is now available in SorobanClient");
            // Ensure we're using the right freighter object
            if (!window.freighter && window.stellar && window.stellar.freighter) {
                window.freighter = window.stellar.freighter;
            }
            this.useMockData = false;
        }
    }

    // Add this method to check for Freighter
    checkForFreighter(maxRetries = 10, currentRetry = 0) {
        if (window.freighter && typeof window.freighter.isConnected === 'function') {
            console.log("Freighter detected in SorobanClient!");
            this.useMockData = false;
            return;
        }
        
        if (currentRetry >= maxRetries) {
            console.warn("Freighter not detected on page load");
            this.useMockData = true;
            return;
        }
        
        setTimeout(() => {
            this.checkForFreighter(maxRetries, currentRetry + 1);
        }, 1000);
    }

    // Connect with a secret key from the user
    async connectWithSecretKey(secretKey) {
        try {
            this.userKeypair = StellarSdk.Keypair.fromSecret(secretKey);
            this.userAddress = new StellarSdk.Address(this.userKeypair.publicKey());
            return {
                publicKey: this.userKeypair.publicKey(),
                connected: true
            };
        } catch (error) {
            console.error("Failed to connect with secret key:", error);
            throw new Error("Invalid secret key");
        }
    }

    // Improve connectWithWallet method
    async connectWithWallet(wallet) {
        try {
            // First try to get Freighter from either location if not provided
            const freighter = wallet || window.freighter || (window.stellar && window.stellar.freighter);
            
            if (!freighter) {
                throw new Error("Wallet provider not available");
            }
            
            console.log("Attempting to connect with wallet...");
            
            // Make sure we can call the necessary methods
            if (!freighter.isConnected || typeof freighter.isConnected !== 'function') {
                throw new Error("Wallet provider does not have isConnected method");
            }
            
            // Try to connect
            const isConnected = await freighter.isConnected();
            if (!isConnected) {
                console.log("Wallet not connected, requesting connection...");
                if (!freighter.connect || typeof freighter.connect !== 'function') {
                    throw new Error("Wallet provider does not have connect method");
                }
                await freighter.connect();
                console.log("Connection requested");
            }
            
            // Get the public key
            if (!freighter.getPublicKey || typeof freighter.getPublicKey !== 'function') {
                throw new Error("Wallet provider does not have getPublicKey method");
            }
            
            const publicKey = await freighter.getPublicKey();
            console.log("Got public key:", publicKey);
            
            if (!publicKey) {
                throw new Error("Failed to get public key from wallet");
            }
            
            this.userAddress = publicKey;
            this.useMockData = false;
            
            return {
                publicKey,
                connected: true
            };
        } catch (error) {
            console.error("Failed to connect with wallet:", error);
            throw new Error(`Failed to connect wallet: ${error.message}`);
        }
    }

    // Get account details and check if funded
    async getAccountDetails() {
        if (!this.userAddress) {
            throw new Error("No connected account");
        }
        
        try {
            const account = await this.server.getAccount(this.userAddress.toString());
            return account;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new Error("Account not found. Please fund your account.");
            }
            throw error;
        }
    }

    // Create a contract instance for interaction
    getContract() {
        return new StellarSdk.Contract(this.contractId);
    }

    // Register a new creative work
    async registerWork(
        title,
        description,
        contentType,
        contentHash,
        primarySalePercentage,
        secondarySalePercentage,
        streamingRate,
        minimumLicenseFee
    ) {
        console.log("Starting registerWork...");
        console.log("Parameters:", {
            title,
            description,
            contentType,
            contentHash,
            primarySalePercentage,
            secondarySalePercentage,
            streamingRate,
            minimumLicenseFee
        });

        if (!this.userAddress) {
            throw new Error("Please connect your wallet first");
        }
        
        if (!this.server) {
            console.log("Server not initialized, falling back to mock data");
            await new Promise(resolve => setTimeout(resolve, 1500));
            return { status: "success", message: "Using mock data - server not initialized" };
        }
        
        try {
            const contract = this.getContract();
            
            // Convert percentages from regular percentages to basis points
            const primarySaleBasisPoints = Math.floor(primarySalePercentage * 100);
            const secondarySaleBasisPoints = Math.floor(secondarySalePercentage * 100);
            
            // For demo purposes, create a simple mock response
            console.log("Using mock data for registerWork");
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            return {
                status: "success",
                workId: Math.floor(Math.random() * 1000) + 1,
                message: "Work registered (mock data)"
            };
        } catch (error) {
            console.error("Error registering work:", error);
            throw error;
        }
    }

    // Process the transaction response and handle status
    async processTransactionResponse(response) {
        // Mock implementation for demo
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            status: "success",
            result: { retval: "mock-result" }
        };
    }

    // Get creator's works
    async getCreatorWorks() {
        if (!this.userAddress) {
            throw new Error("Please connect your wallet first");
        }
        
        try {
            console.log("Using mock data for getCreatorWorks");
            // Return mock work IDs
            return [1, 2, 3];
        } catch (error) {
            console.error("Error getting creator works:", error);
            throw error;
        }
    }

    // Get details about a specific work
    async getWorkDetails(workId) {
        try {
            console.log("Using mock data for getWorkDetails:", workId);
            
            // Mock work details
            return {
                workId: workId,
                creator: this.userAddress ? this.userAddress.toString() : "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI",
                title: `Work #${workId}`,
                description: "This is a sample work description from the Soroban contract.",
                creationTime: Date.now() - 86400000, // 1 day ago
                contentType: ["image", "music", "video", "text"][workId % 4],
                isActive: true,
                licenseCount: workId % 5,
                contentHash: `QmHash${workId}${Date.now()}`
            };
        } catch (error) {
            console.error("Error getting work details:", error);
            throw error;
        }
    }

    // Get royalty configuration for a work
    async getRoyaltyConfig(workId) {
        try {
            console.log("Using mock data for getRoyaltyConfig:", workId);
            
            // Mock royalty config
            return {
                workId: Number(workId),
                primarySalePercentage: 10, // 10%
                secondarySalePercentage: 5,  // 5%
                streamingRate: 0.001,
                minimumLicenseFee: 0.01
            };
        } catch (error) {
            console.error("Error getting royalty config:", error);
            throw error;
        }
    }

    // Helper to parse U256 values to Numbers
    parseU256ToNumber(u256Val) {
        // This is a simplification - for production you'd want more robust conversion
        return 0.01; // Mock value
    }

    // Purchase a license for a work
    async purchaseLicense(workId, licenseType, durationSeconds, paymentAmount) {
        if (!this.userAddress) {
            throw new Error("Please connect your wallet first");
        }
        
        try {
            console.log("Using mock data for purchaseLicense:", {
                workId, licenseType, durationSeconds, paymentAmount
            });
            
            // Simulate transaction delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Return mock license ID
            return {
                status: "success",
                licenseId: Math.floor(Math.random() * 1000) + 1
            };
        } catch (error) {
            console.error("Error purchasing license:", error);
            throw error;
        }
    }

    // Get system statistics
    async getRoyaltyStats() {
        try {
            console.log("Using mock data for getRoyaltyStats");
            
            // Mock royalty stats
            return {
                totalWorks: 5,
                totalLicenses: 12,
                totalPayments: 15,
                totalRevenue: 0.25,
            };
        } catch (error) {
            console.error("Error getting royalty stats:", error);
            throw error;
        }
    }
}