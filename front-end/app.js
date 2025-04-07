// Main application logic for the Digital Royalty System
import { SorobanClient } from './soroban-client.js';

// Mock contract ABI - In a real application, this would be the actual contract ABI
const contractABI = [
    {
        "inputs": [
            { "name": "title", "type": "string" },
            { "name": "description", "type": "string" },
            { "name": "contentHash", "type": "string" },
            { "name": "workType", "type": "string" },
            { "name": "royaltyPercentage", "type": "uint8" }
        ],
        "name": "registerWork",
        "outputs": [{ "name": "workId", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "workId", "type": "uint256" },
            { "name": "licenseType", "type": "string" }
        ],
        "name": "licenseWork",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getMyWorks",
        "outputs": [{ "name": "works", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "workId", "type": "uint256" }],
        "name": "getWorkDetails",
        "outputs": [
            { "name": "title", "type": "string" },
            { "name": "creator", "type": "address" },
            { "name": "description", "type": "string" },
            { "name": "contentHash", "type": "string" },
            { "name": "workType", "type": "string" },
            { "name": "royaltyPercentage", "type": "uint8" },
            { "name": "creationDate", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getMyRoyalties",
        "outputs": [
            { "name": "totalEarned", "type": "uint256" },
            { "name": "pending", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Contract address - Would be the deployed contract address in a real application
const CONTRACT_ADDRESS = "0x123456789abcdef123456789abcdef123456789a";

// Main application class
class RoyaltyApp {
    constructor() {
        // Initialize the Soroban client
        this.sorobanClient = new SorobanClient();
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.account = null;
        this.connected = false;

        // DOM elements
        this.connectWalletBtn = document.getElementById('connect-wallet');
        this.walletAddressSpan = document.getElementById('wallet-address');
        this.tabs = document.querySelectorAll('.tab');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.registerForm = document.getElementById('register-form');
        this.worksContainer = document.getElementById('works-container');
        this.royaltyHistory = document.getElementById('royalty-history');
        this.licenseWorksContainer = document.getElementById('license-works-container');
        this.searchBtn = document.getElementById('search-btn');
        this.searchInput = document.getElementById('search-works');
        this.modal = document.getElementById('work-modal');
        this.closeModal = document.querySelector('.close');
        this.licenseForm = document.getElementById('license-form');
        this.connectionIndicator = document.getElementById('connection-indicator');
        this.connectionText = document.getElementById('connection-text');

        // Initialize the application
        this.init();

        // Fallback to mock data if contract interaction fails
        this.useMockData = false;
        this.mockData = {
            works: [
                {
                    id: 1,
                    title: "Digital Landscape Painting",
                    description: "A serene landscape with mountains and a lake",
                    creator: "0x1234...5678",
                    contentHash: "QmHash1...",
                    workType: "image",
                    royaltyPercentage: 10,
                    creationDate: Date.now() - 1000000
                },
                {
                    id: 2,
                    title: "Electronic Music Track",
                    description: "Upbeat electronic dance music track",
                    creator: "0x9876...5432",
                    contentHash: "QmHash2...",
                    workType: "music",
                    royaltyPercentage: 15,
                    creationDate: Date.now() - 2000000
                },
                {
                    id: 3,
                    title: "Short Story Collection",
                    description: "A collection of sci-fi short stories",
                    creator: "0x5678...1234",
                    contentHash: "QmHash3...",
                    workType: "text",
                    royaltyPercentage: 8,
                    creationDate: Date.now() - 3000000
                }
            ],
            royalties: [
                {
                    workId: 1,
                    workTitle: "Digital Landscape Painting",
                    amount: 0.05,
                    licensee: "0xabcd...ef01",
                    date: Date.now() - 500000
                },
                {
                    workId: 1,
                    workTitle: "Digital Landscape Painting",
                    amount: 0.03,
                    licensee: "0x2345...6789",
                    date: Date.now() - 200000
                }
            ],
            stats: {
                totalEarned: 0.08,
                pending: 0.02,
                worksCount: 3
            }
        };
    }

    init() {
        // Set up event listeners
        this.connectWalletBtn.addEventListener('click', () => this.connectWallet());
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab));
        });
        this.registerForm.addEventListener('submit', (e) => this.handleRegisterWork(e));
        this.searchBtn.addEventListener('click', () => this.searchWorks());
        this.closeModal.addEventListener('click', () => this.modal.style.display = 'none');
        this.licenseForm.addEventListener('submit', (e) => this.handleLicenseWork(e));

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.modal.style.display = 'none';
            }
        });

        // Check if Freighter wallet is available
        this.checkWalletProvider();

        // Check connection status
        this.updateConnectionStatus('connecting');
        this.checkBackendConnection();
    }

    checkWalletProvider() {
        // Check if Freighter is available
        if (window.freighter) {
            console.log("Freighter wallet detected");
            this.connectWalletBtn.disabled = false;
            
            // Check if the user is already connected to Freighter
            window.freighter.isConnected()
                .then(connected => {
                    if (connected) {
                        // Auto-connect if user already has Freighter connected
                        this.connectWallet();
                    }
                })
                .catch(error => {
                    console.error("Error checking Freighter connection:", error);
                });
        } 
        // Fallback to Ethereum wallet if Freighter is not available
        else if (window.ethereum) {
            console.log("Ethereum wallet detected (fallback)");
            this.connectWalletBtn.disabled = false;
            
            // Handle chain changes
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });

            // Handle account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    // User disconnected
                    this.account = null;
                    this.connected = false;
                    this.walletAddressSpan.textContent = 'Wallet not connected';
                    this.connectWalletBtn.textContent = 'Connect Wallet';
                } else {
                    this.account = accounts[0];
                    this.connected = true;
                    this.updateWalletUI();
                    this.loadUserData();
                }
            });
        } else {
            this.connectWalletBtn.disabled = true;
            this.walletAddressSpan.textContent = 'No wallet provider detected';
            console.warn('No wallet provider detected. Please install Freighter for Stellar or MetaMask.');
        }
    }

    async connectWallet() {
        try {
            // Try to connect with Freighter first
            if (window.freighter) {
                // Attempt to connect with Freighter
                const result = await this.sorobanClient.connectWithWallet(window.freighter);
                this.account = result.publicKey;
                this.connected = result.connected;
                
                // Update UI
                this.updateWalletUI();
                
                // Load user data
                if (this.connected) {
                    this.loadUserData();
                }
                return;
            } 
            // Fallback to Ethereum wallet
            else if (window.ethereum) {
                // Request account access
                const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
                this.account = accounts[0];
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
                this.connected = true;
                
                // Update UI
                this.updateWalletUI();
                
                // Load user data
                this.loadUserData();
                
                // Since we're not using Soroban in this case, set to use mock data
                this.useMockData = true;
                return;
            }

            alert('No wallet provider detected. Please install Freighter or MetaMask.');
        } catch (error) {
            console.error('Error connecting to wallet:', error);
            alert('Failed to connect to wallet: ' + error.message);
        }
    }

    updateWalletUI() {
        if (this.account && this.connected) {
            const shortAddress = this.account.substring(0, 6) + '...' + this.account.substring(this.account.length - 4);
            this.walletAddressSpan.textContent = shortAddress;
            this.connectWalletBtn.textContent = 'Connected';
            this.connectWalletBtn.disabled = true;
        } else {
            this.walletAddressSpan.textContent = 'Wallet not connected';
            this.connectWalletBtn.textContent = 'Connect Wallet';
            this.connectWalletBtn.disabled = false;
        }
    }

    switchTab(selectedTab) {
        // Remove active class from all tabs and content
        this.tabs.forEach(tab => tab.classList.remove('active'));
        this.tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        selectedTab.classList.add('active');
        const tabId = selectedTab.dataset.tab;
        document.getElementById(tabId).classList.add('active');
        
        // Load data based on selected tab
        if (tabId === 'my-works' && this.account && this.connected) {
            this.loadUserWorks();
        } else if (tabId === 'royalties' && this.account && this.connected) {
            this.loadUserRoyalties();
        }
    }

    async loadUserData() {
        if (!this.account || !this.connected) return;
        
        // Load user works for "My Works" tab
        this.loadUserWorks();
        
        // Load royalty data for "Royalties" tab
        this.loadUserRoyalties();
    }

    async loadUserWorks() {
        // Clear current works
        this.worksContainer.innerHTML = '';
        
        try {
            if (!this.useMockData && this.sorobanClient) {
                // Get work IDs from the contract
                const workIds = await this.sorobanClient.getCreatorWorks();
                
                if (workIds.length === 0) {
                    this.worksContainer.innerHTML = '<div class="empty-state">You haven\'t registered any works yet.</div>';
                    return;
                }
                
                // Fetch details for each work
                for (const workId of workIds) {
                    const work = await this.sorobanClient.getWorkDetails(workId);
                    const workCard = this.createWorkCard(work);
                    this.worksContainer.appendChild(workCard);
                }
            } else {
                // Fallback to mock data
                const works = this.mockData.works;
                
                if (works.length === 0) {
                    this.worksContainer.innerHTML = '<div class="empty-state">You haven\'t registered any works yet.</div>';
                    return;
                }
                
                works.forEach(work => {
                    const workCard = this.createWorkCard(work);
                    this.worksContainer.appendChild(workCard);
                });
            }
        } catch (error) {
            console.error('Error loading works:', error);
            
            // Fall back to mock data if there's an error
            this.useMockData = true;
            this.worksContainer.innerHTML = '<div class="empty-state">Error loading from blockchain. Using mock data.</div>';
            
            setTimeout(() => {
                this.loadUserWorks();
            }, 1000);
        }
    }

    createWorkCard(work) {
        const card = document.createElement('div');
        card.className = 'work-card';
        
        // Determine placeholder image based on work type
        // For Soroban contract, use contentType, for mock data use workType
        const workType = work.contentType || work.workType;
        let placeholderImg;
        
        switch (workType) {
            case 'image':
                placeholderImg = 'https://via.placeholder.com/300x180?text=Image';
                break;
            case 'music':
                placeholderImg = 'https://via.placeholder.com/300x180?text=Music';
                break;
            case 'video':
                placeholderImg = 'https://via.placeholder.com/300x180?text=Video';
                break;
            case 'text':
                placeholderImg = 'https://via.placeholder.com/300x180?text=Text';
                break;
            default:
                placeholderImg = 'https://via.placeholder.com/300x180?text=Digital+Work';
        }
        
        // Format creation date - use appropriate field based on data source
        const creationDate = work.creationTime || work.creationDate;
        const date = new Date(creationDate);
        
        // Title
        const title = work.title || "Untitled Work";
        
        // Get royalty percentage - for Soroban we'll need to get this separately through royalty config
        const royaltyPercentage = work.royaltyPercentage || 10; // Default to 10% if not available
        
        card.innerHTML = `
            <div class="work-card-image" style="background-image: url('${placeholderImg}')"></div>
            <div class="work-card-content">
                <h3>${title}</h3>
                <div class="work-card-meta">
                    <span>${workType}</span>
                    <span>Royalty: ${royaltyPercentage}%</span>
                </div>
                <p>${(work.description || "").substring(0, 100)}${(work.description || "").length > 100 ? '...' : ''}</p>
                <div class="work-card-actions">
                    <button class="btn view-details" data-work-id="${work.workId || work.id}">View Details</button>
                </div>
            </div>
        `;
        
        // Add event listener to view details button
        card.querySelector('.view-details').addEventListener('click', () => {
            this.showWorkDetails(work);
        });
        
        return card;
    }

    async showWorkDetails(work) {
        const modalTitle = document.getElementById('modal-title');
        const modalContent = document.getElementById('modal-content');
        const licenseSection = document.getElementById('license-section');
        
        modalTitle.textContent = work.title || "Untitled";
        
        try {
            // If using Soroban and we need additional details
            if (!this.useMockData && this.sorobanClient && work.workId) {
                // Get royalty configuration
                const royaltyConfig = await this.sorobanClient.getRoyaltyConfig(work.workId);
                work.royaltyPercentage = royaltyConfig.primarySalePercentage;
            }
        } catch (error) {
            console.error("Error fetching additional work details:", error);
        }
        
        // Format creation date
        const creationTime = work.creationTime || work.creationDate;
        const creationDate = new Date(creationTime).toLocaleDateString();
        
        const creator = work.creator || "Unknown Creator";
        const workType = work.contentType || work.workType || "Unknown Type";
        const royaltyPercentage = work.royaltyPercentage || 0;
        const description = work.description || "No description provided";
        const contentHash = work.contentHash || "No content hash";
        
        modalContent.innerHTML = `
            <div class="work-details">
                <p><strong>Creator:</strong> ${creator}</p>
                <p><strong>Type:</strong> ${workType}</p>
                <p><strong>Description:</strong> ${description}</p>
                <p><strong>Royalty Percentage:</strong> ${royaltyPercentage}%</p>
                <p><strong>Created:</strong> ${creationDate}</p>
                <p><strong>Content Hash:</strong> <code>${contentHash}</code></p>
            </div>
        `;
        
        // If the current user is the creator, hide license section
        if (this.account && this.account.toLowerCase() === creator.toLowerCase()) {
            licenseSection.style.display = 'none';
        } else {
            licenseSection.style.display = 'block';
            // Set the work ID in the license form
            const licenseForm = document.getElementById('license-form');
            licenseForm.dataset.workId = work.workId || work.id;
        }
        
        // Show modal
        this.modal.style.display = 'block';
    }

    async loadUserRoyalties() {
        try {
            let royaltyStats = { totalEarned: 0, pending: 0, worksCount: 0 };
            let royalties = [];
            
            if (!this.useMockData && this.sorobanClient) {
                // Try to get royalty data from the contract
                try {
                    const stats = await this.sorobanClient.getRoyaltyStats();
                    royaltyStats.totalEarned = stats.totalRevenue || 0;
                    royaltyStats.worksCount = stats.totalWorks || 0;
                    
                    // To get payment history would require additional contract calls
                    // This would be implementation-specific based on how the contract tracks payments
                } catch (error) {
                    console.error("Error loading royalty stats from contract:", error);
                    // Fall back to mock data for royalty stats
                    royaltyStats = this.mockData.stats;
                    royalties = this.mockData.royalties;
                }
            } else {
                // Use mock data
                royaltyStats = this.mockData.stats;
                royalties = this.mockData.royalties;
            }
            
            // Update royalty stats
            document.getElementById('total-royalties').textContent = `${royaltyStats.totalEarned} ETH`;
            document.getElementById('pending-royalties').textContent = `${royaltyStats.pending || 0} ETH`;
            document.getElementById('works-count').textContent = royaltyStats.worksCount;
            
            // Clear current royalty history
            this.royaltyHistory.innerHTML = '';
            
            if (royalties.length === 0) {
                this.royaltyHistory.innerHTML = '<tr><td colspan="4" class="empty-state">No royalty transactions yet.</td></tr>';
                return;
            }
            
            royalties.forEach(royalty => {
                const row = document.createElement('tr');
                const date = new Date(royalty.date).toLocaleDateString();
                row.innerHTML = `
                    <td>${date}</td>
                    <td>${royalty.workTitle}</td>
                    <td>${royalty.licensee.substring(0, 6)}...${royalty.licensee.substring(royalty.licensee.length - 4)}</td>
                    <td>${royalty.amount} ETH</td>
                `;
                this.royaltyHistory.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading royalties:', error);
            this.royaltyHistory.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading royalty data.</td></tr>';
        }
    }

    async handleRegisterWork(event) {
        event.preventDefault();
        
        if (!this.account || !this.connected) {
            alert('Please connect your wallet first');
            return;
        }
        
        const title = document.getElementById('work-title').value;
        const description = document.getElementById('work-desc').value;
        const workType = document.getElementById('work-type').value;
        const workFile = document.getElementById('work-file').files[0];
        const workLink = document.getElementById('work-link').value;
        const royaltyPercent = parseInt(document.getElementById('royalty-percent').value);
        
        if (!title) {
            alert('Please enter a title for your work');
            return;
        }
        
        if (royaltyPercent < 0 || royaltyPercent > 100) {
            alert('Royalty percentage must be between 0 and 100');
            return;
        }
        
        // Generate content hash
        let contentHash;
        if (workLink) {
            contentHash = workLink;
        } else if (workFile) {
            // In production, would upload to IPFS or similar storage
            // For now, just generate a mock hash
            contentHash = `QmSimulated${Date.now()}`;
        } else {
            alert('Please either upload a file or provide a content link/hash');
            return;
        }
        
        try {
            // Show loading state
            const submitBtn = this.registerForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Registering...';
            submitBtn.disabled = true;
            
            if (!this.useMockData && this.sorobanClient) {
                // Call Soroban contract to register work
                // For simplicity, using fixed values for secondary sale and streaming rates
                await this.sorobanClient.registerWork(
                    title,
                    description,
                    workType,
                    contentHash,
                    royaltyPercent,  // primary sale percentage
                    royaltyPercent / 2,  // secondary sale percentage (half of primary)
                    0.001,  // streamingRate (token amount)
                    0.01    // minimumLicenseFee (token amount)
                );
                
                // Show success message
                alert('Work registered successfully on blockchain!');
            } else {
                // Using mock data
                // Simulate blockchain delay
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Add to mock data for demonstration
                const newWork = {
                    id: this.mockData.works.length + 1,
                    title,
                    description,
                    creator: this.account,
                    contentHash,
                    workType,
                    royaltyPercentage: royaltyPercent,
                    creationDate: Date.now()
                };
                
                this.mockData.works.push(newWork);
                this.mockData.stats.worksCount++;
                
                // Show success message
                alert('Work registered successfully! (Using mock data)');
            }
            
            // Reset form
            this.registerForm.reset();
            
            // Switch to My Works tab and refresh
            const myWorksTab = document.querySelector('.tab[data-tab="my-works"]');
            this.switchTab(myWorksTab);
            
            // Reset button
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
            
        } catch (error) {
            console.error('Error registering work:', error);
            alert('Error registering work: ' + error.message);
            
            // Reset button
            const submitBtn = this.registerForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Register Work';
            submitBtn.disabled = false;
        }
    }

    async searchWorks() {
        const query = this.searchInput.value.trim().toLowerCase();
        
        if (!query) {
            this.licenseWorksContainer.innerHTML = '<div class="empty-state">Enter search terms to find works</div>';
            return;
        }
        
        // In a real app with Soroban, we'd need a search index or query API
        // For now, just search the mock data
        
        const results = this.mockData.works.filter(work => {
            return work.title.toLowerCase().includes(query) ||
                   work.description.toLowerCase().includes(query) ||
                   work.creator.toLowerCase().includes(query);
        });
        
        // Clear previous results
        this.licenseWorksContainer.innerHTML = '';
        
        if (results.length === 0) {
            this.licenseWorksContainer.innerHTML = '<div class="empty-state">No works found matching your search</div>';
            return;
        }
        
        // Display search results
        results.forEach(work => {
            const workCard = this.createWorkCard(work);
            this.licenseWorksContainer.appendChild(workCard);
        });
    }

    async handleLicenseWork(event) {
        event.preventDefault();
        
        if (!this.account || !this.connected) {
            alert('Please connect your wallet first');
            return;
        }
        
        const workId = event.target.dataset.workId;
        const licenseType = document.getElementById('license-type').value;
        const amount = parseFloat(document.getElementById('license-amount').value);
        
        if (!workId) {
            alert('Work ID is missing');
            return;
        }
        
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        
        try {
            // Show loading state
            const submitBtn = this.licenseForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            
            if (!this.useMockData && this.sorobanClient) {
                // Call contract to purchase license
                // Use perpetual license (0 duration) for simplicity
                await this.sorobanClient.purchaseLicense(
                    workId,
                    licenseType,
                    0,  // perpetual license
                    amount
                );
                
                // Show success message
                alert(`Successfully licensed work for ${amount} tokens!`);
            } else {
                // Using mock data
                // Simulate blockchain delay
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Add to mock data for demonstration
                const licensedWork = this.mockData.works.find(w => w.id == workId);
                
                const newRoyalty = {
                    workId,
                    workTitle: licensedWork.title,
                    amount,
                    licensee: this.account,
                    date: Date.now()
                };
                
                this.mockData.royalties.push(newRoyalty);
                this.mockData.stats.totalEarned += amount;
                
                // Show success message
                alert(`Successfully licensed "${licensedWork.title}" for ${amount} ETH! (Using mock data)`);
            }
            
            // Close modal
            this.modal.style.display = 'none';
            
            // Reset form
            this.licenseForm.reset();
            
            // Reset button
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
            
        } catch (error) {
            console.error('Error licensing work:', error);
            alert('Error licensing work: ' + error.message);
            
            // Reset button
            const submitBtn = this.licenseForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Pay Royalty & License';
            submitBtn.disabled = false;
        }
    }

    updateConnectionStatus(status) {
        if (!this.connectionIndicator) return;
        
        this.connectionIndicator.className = 'indicator';
        
        switch(status) {
            case 'connected':
                this.connectionIndicator.classList.add('connected');
                this.connectionText.textContent = 'Backend connection: Connected';
                break;
            case 'connecting':
                this.connectionIndicator.classList.add('connecting');
                this.connectionText.textContent = 'Backend connection: Connecting...';
                break;
            case 'disconnected':
                this.connectionIndicator.classList.add('disconnected');
                this.connectionText.textContent = 'Backend connection: Disconnected (using mock data)';
                break;
            default:
                this.connectionText.textContent = 'Backend connection: Unknown';
        }
    }

    async checkBackendConnection() {
        try {
            // Try to get stats from the contract to check connection
            if (this.sorobanClient && this.sorobanClient.server) {
                await this.sorobanClient.getRoyaltyStats();
                this.updateConnectionStatus('connected');
                this.useMockData = false;
            } else {
                throw new Error("Server not initialized");
            }
        } catch (error) {
            console.warn("Backend connection failed, using mock data:", error);
            this.updateConnectionStatus('disconnected');
            this.useMockData = true;
        }
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new RoyaltyApp();
});