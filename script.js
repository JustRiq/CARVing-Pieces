// === DEFINE SOLANA WEB3 OBJECTS ===
// (We add SystemProgram and Transaction)
const { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } = solanaWeb3;

// === SET YOUR CARV SVM RPC ENDPOINT ===
const RPC_ENDPOINT = "https://rpc.testnet.carv.io/rpc";

// === DEFINE PAYMENT AND BALANCE CONSTANTS ===
const PAYMENT_AMOUNT_SOL = 0.001;
const PAYMENT_AMOUNT_LAMPORTS = PAYMENT_AMOUNT_SOL * LAMPORTS_PER_SOL;
const MIN_TX_FEE_SOL = 0.00001; // A safe buffer for the transaction fee
const MIN_BALANCE_SOL = PAYMENT_AMOUNT_SOL + MIN_TX_FEE_SOL; // Minimum balance needed to connect

// === 🛑 YOUR TREASURY WALLET ADDRESS ===
// All payments will be sent to this address.
const TREASURY_ADDRESS = new PublicKey("EX7C3e3xyymyF42kJ9bEEv1NeZuDGDEFpgHdeTsjkJt8");

// === NEW: CHARITY GOAL ===
const CHARITY_GOAL_SOL = 2; // The goal is 2 SOL

// === CREATE A GLOBAL CONNECTION OBJECT ===
const connection = new Connection(RPC_ENDPOINT, 'confirmed');


// --- Game board variables ---
const PUZZLE_ROWS = 3;
const PUZZLE_COLS = 3;
const PIECE_WIDTH = 100;
const PIECE_HEIGHT = 100;
const BOARD_WIDTH = PUZZLE_COLS * PIECE_WIDTH;
const BOARD_HEIGHT = PUZZLE_ROWS * PIECE_HEIGHT;

// --- Game State Variables ---
let draggedPieceId = null;
let timerInterval = null; 
let timerStartTime = 0; 
let finalTime = 0; // This will store the final time (in seconds)

// --- WEB3 STATE VARIABLES ---
let connectedProvider = null;
let connectedPublicKey = null;


document.addEventListener("DOMContentLoaded", () => {
    console.log("Jigsaw Puzzle Game Loaded!"); 
    console.log("Using RPC:", RPC_ENDPOINT); 
    
    // --- Get DOM Elements ---
    const imageUploadInput = document.getElementById("imageUpload");
    const pieceContainer = document.getElementById("piece-container"); 
    const connectButton = document.getElementById("connect-wallet-button");
    const disconnectButton = document.getElementById("disconnect-wallet-button"); 
    const walletAddressEl = document.getElementById("wallet-address");
    const tryAgainBtn = document.getElementById("try-again-button");
    const shareTwitterBtn = document.getElementById("share-twitter-button");
    const howToPlayGuide = document.getElementById("how-to-play"); // <-- NEW
    
    // === INTRO MODAL LOGIC ===
    const introModal = document.getElementById("intro-modal-overlay");
    const introOkButton = document.getElementById("intro-ok-button");
    const gameContainer = document.querySelector(".game-container");

    introOkButton.addEventListener("click", () => {
        introModal.style.display = "none"; // Hide the intro modal
        gameContainer.style.display = "flex"; // Show the main game
    });
    // === END OF INTRO LOGIC ===

    // === THEME TOGGLE LOGIC ===
    const themeToggle = document.getElementById("checkbox");
    const body = document.body;
    const themeLabel = document.querySelector(".theme-switch-wrapper em");

    // 1. Check for saved theme in localStorage
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "day") {
        body.classList.add("day-mode");
        themeToggle.checked = true;
        themeLabel.innerText = "Day Mode";
    } else {
        themeLabel.innerText = "Night Mode"; // Default
    }

    // 2. Add listener for the toggle
    themeToggle.addEventListener("change", () => {
        if (themeToggle.checked) {
            body.classList.add("day-mode");
            themeLabel.innerText = "Day Mode";
            localStorage.setItem("theme", "day");
        } else {
            body.classList.remove("day-mode");
            themeLabel.innerText = "Night Mode";
            localStorage.setItem("theme", "night");
        }
    });
    // === END OF THEME LOGIC ===

    // === LEFT PANEL BUTTON LOGIC ===
    const btnClose = document.getElementById("btn-close");
    const btnMainMenu = document.getElementById("btn-main-menu");
    const btnMyPuzzles = document.getElementById("btn-my-puzzles");
    const btnPuzzleStore = document.getElementById("btn-puzzle-store");
    const btnAchievements = document.getElementById("btn-achievements");
    const btnSettings = document.getElementById("btn-settings");

    // Reload buttons
    btnClose.addEventListener("click", () => location.reload());
    btnMainMenu.addEventListener("click", () => location.reload());

    // "Coming Soon" buttons
    const comingSoonAlert = () => {
        alert("Feature Coming Soon!");
    };
    btnMyPuzzles.addEventListener("click", comingSoonAlert);
    btnPuzzleStore.addEventListener("click", comingSoonAlert);
    btnAchievements.addEventListener("click", comingSoonAlert);
    btnSettings.addEventListener("click", comingSoonAlert);
    // === END OF LEFT PANEL LOGIC ===


    // --- Event Listeners ---
    imageUploadInput.addEventListener("change", (event) => {
        handleImageUpload(event); // <-- THIS FUNCTION NOW TRIGGERS PAYMENT
    });

    if (pieceContainer) {
        pieceContainer.addEventListener("dragover", (e) => e.preventDefault()); 
        pieceContainer.addEventListener("drop", drop); 
    } else {
        console.error("CRITICAL ERROR: 'piece-container' element not found in HTML.");
    }
    
    // --- Connect Wallet Button Listener ---
    connectButton.addEventListener("click", async () => {
        let provider = null;
        let walletName = "";

        // 1. Check for Backpack first
        if (window.backpack) {
            provider = window.backpack;
            walletName = "Backpack";
        } 
        // 2. Else, check for Phantom (or other standard Solana wallets)
        else if (window.solana) {
            provider = window.solana;
            walletName = "Phantom/Solana";
        }

        // 3. If we found a provider
        if (provider) {
            try {
                // Request connection
                const response = await provider.connect();
                const userPublicKey = new PublicKey(response.publicKey.toString());
                
                // --- SET GLOBAL WEB3 STATE ---
                connectedProvider = provider; 
                connectedPublicKey = userPublicKey;
                
                // --- UPDATE UI PARTIALLY ---
                walletAddressEl.innerText = `Connected: ${userPublicKey.toString()}\n(Verifying RPC & Balance...)`;
                console.log(`Connected with ${walletName} Public Key:`, userPublicKey.toString());


                // === TEST THE RPC CONNECTION AND CHECK BALANCE ===
                try {
                    const balance = await connection.getBalance(userPublicKey); // In Lamports
                    const balanceInSol = balance / LAMPORTS_PER_SOL;
                    console.log(`User balance (from ${RPC_ENDPOINT}): ${balanceInSol} SOL`);
                    
                    // === CHECK MINIMUM BALANCE (NOW INCLUDES PAYMENT + FEE) ===
                    if (balanceInSol >= MIN_BALANCE_SOL) {
                        // --- SUCCESS! NOW REVEAL THE GAME ---
                        walletAddressEl.innerText = `Connected: ${userPublicKey.toString()}\nBalance: ${balanceInSol.toFixed(4)} SOL`;
                        connectButton.style.display = 'none'; // Hide Connect
                        disconnectButton.style.display = 'block'; // Show Disconnect
                        
                        document.getElementById("upload-section").style.display = "block";
                        document.getElementById("puzzle-area").style.display = "flex";
                        howToPlayGuide.style.display = "none"; // <-- HIDE "HOW TO PLAY"
                        
                        loadTransactionHistory(); // <-- LOAD TX HISTORY
                        updateCharityProgress(); // <-- LOAD PROGRESS BAR
                    } else {
                        // --- BALANCE TOO LOW! KEEP GAME LOCKED. ---
                        walletAddressEl.innerText = `Connected: ${userPublicKey.toString()}`;
                        
                        // English Alert for low balance
                        alert(`Connection failed.\n\nYour balance is ${balanceInSol.toFixed(6)} SOL. You need at least ${MIN_BALANCE_SOL} SOL (Testnet) to pay for the game fee (${PAYMENT_AMOUNT_SOL} SOL) and network fees.`);
                        
                        // Disconnect provider
                        await provider.disconnect();
                        connectedProvider = null;
                        connectedPublicKey = null;
                        walletAddressEl.innerText = "Connection failed (Insufficient balance).";
                    }

                } catch (balanceError) {
                    // --- RPC TEST FAILED! KEEP GAME LOCKED. ---
                    console.error("Failed to get balance using CARV RPC:", balanceError);
                    walletAddressEl.innerText = `Connected: ${userPublicKey.toString()}`;
                    
                    // English Alert for wrong network
                    alert(`Failed to connect to CARV SVM RPC.\n\nPlease ensure your wallet is set to the correct network:\nhttps://rpc.testnet.carv.io/rpc\n\nAfter changing, please try connecting again.`);
                    
                    // Disconnect provider
                    await provider.disconnect();
                    connectedProvider = null;
                    connectedPublicKey = null;
                    walletAddressEl.innerText = "Connection failed (RPC error).";
                }

            } catch (err) {
                // Wallet connection itself was rejected by the user
                console.error("Wallet connection failed (user rejected):", err);
                walletAddressEl.innerText = "Connection failed!";
            }
        } 
        // 4. If no wallet is found
        else {
            alert("No Solana wallet (like Backpack) found! Please install one."); // <-- UPDATED
            walletAddressEl.innerText = "No wallet found.";
        }
    });

    // --- DISCONNECT WALLET BUTTON LISTENER ---
    disconnectButton.addEventListener("click", async () => {
        if (connectedProvider) {
            try {
                await connectedProvider.disconnect();
            } catch (err) {
                console.error("Error during disconnect:", err);
            } finally {
                // --- RESET UI TO DEFAULT STATE ---
                connectedProvider = null;
                connectedPublicKey = null;
                
                walletAddressEl.innerText = ""; // Clear address
                connectButton.style.display = 'block'; // Show Connect
                disconnectButton.style.display = 'none'; // Hide Disconnect
                
                // Hide game elements
                document.getElementById("upload-section").style.display = "none";
                document.getElementById("puzzle-area").style.display = "none";
                howToPlayGuide.style.display = "block"; // <-- SHOW "HOW TO PLAY"
                
                // Stop and reset timer
                stopTimer();
                document.getElementById("timer").innerText = "Time: 00:00";
                
                // Clear puzzle board
                const pieceContainer = document.getElementById("piece-container");
                if (pieceContainer) { // Check again just in case
                    pieceContainer.innerHTML = "";
                }
                document.getElementById("board-container").innerHTML = "";
                document.getElementById("original-image-preview").innerHTML = "";
                document.getElementById("tx-history-panel").innerHTML = "<h4>My Tx History</h4>"; // <-- CLEAR TX HISTORY
                
                console.log("Wallet disconnected.");
            }
        }
    });

    // --- "Try Again" Modal Button Listener ---
    tryAgainBtn.addEventListener("click", () => {
        location.reload(); 
    });

    // === SHARE TO TWITTER BUTTON LISTENER ===
    shareTwitterBtn.addEventListener("click", () => {
        // Get the formatted time from the global variable
        const formattedTime = formatTime(finalTime); 
        
        // --- UPDATED TWEET TEXT ---
        const tweetText = `I just completed the "CARVing Pieces" puzzle in ${formattedTime}! 🧩\n\nI paid 0.001 SOL to play and 100% of it went to charity. \n\nPlay for charity on CARV SVM! @CashieCARV #CARVingPieces #CARV #PlayForCharity`;
        
        // Create the Twitter Web Intent URL
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        
        // Open in a new tab
        window.open(twitterUrl, '_blank');
    });

    // === NEW: Load charity progress on page load ===
    updateCharityProgress();
});

/**
 * Handles the user-uploaded file.
 * === THIS FUNCTION NOW TRIGGERS PAYMENT ===
 */
async function handleImageUpload(event) { // <-- Function is now ASYNC
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        return; 
    }

    // --- NEW: PAYMENT LOGIC ---
    if (!connectedProvider || !connectedPublicKey) {
        alert("Please connect your wallet first.");
        event.target.value = null; // Reset file input
        return;
    }

    console.log(`Attempting to send ${PAYMENT_AMOUNT_SOL} SOL transaction to ${TREASURY_ADDRESS.toString()}...`);
    
    try {
        // 1. Get a recent blockhash
        const { blockhash } = await connection.getRecentBlockhash();

        // 2. Create a new transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: connectedPublicKey,
                toPubkey: TREASURY_ADDRESS,
                lamports: PAYMENT_AMOUNT_LAMPORTS,
            })
        );
        transaction.feePayer = connectedPublicKey;
        transaction.recentBlockhash = blockhash;

        // 3. Sign and send the transaction using the wallet provider
        // This will trigger the wallet pop-up
        const { signature } = await connectedProvider.signAndSendTransaction(transaction);
        
        // 4. Confirm the transaction
        console.log("Transaction sent, awaiting confirmation...");
        await connection.confirmTransaction(signature, 'confirmed');

        console.log("Payment successful! Signature:", signature);
        
        // === NEW: SAVE TX TO HISTORY & UPDATE PROGRESS BAR ===
        saveTransactionToHistory(signature);
        loadTransactionHistory(); // Reload history panel
        updateCharityProgress(); // <-- REFRESH PROGRESS BAR
        // === END OF NEW CODE ===
        
        // --- PAYMENT SUCCESSFUL - PROCEED WITH PUZZLE ---
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            displayOriginalImagePreview(imageUrl); 
            setupPuzzle(imageUrl); 
        };
        reader.readAsDataURL(file);
        // --- END OF PUZZLE LOGIC ---

    } catch (err) {
        console.error("Payment failed:", err);
        event.target.value = null; // Reset file input
        alert("Payment failed. The puzzle will not be loaded.\n\nPlease try refreshing the page or reconnecting your wallet.");
    }
    // --- END OF NEW PAYMENT LOGIC ---
}

/**
 * Displays the uploaded image in the original image preview panel.
 */
function displayOriginalImagePreview(imageUrl) {
    const previewContainer = document.getElementById("original-image-preview");
    previewContainer.innerHTML = ""; 
    const imgElement = document.createElement("img");
    imgElement.src = imageUrl;
    imgElement.alt = "Original Image";
    previewContainer.appendChild(imgElement);
}


/**
 * Main function to create puzzle pieces and board.
 */
function setupPuzzle(imageUrl) {
    const pieceContainer = document.getElementById("piece-container");
    const boardContainer = document.getElementById("board-container");
    
    // Check if containers exist before clearing
    if (pieceContainer) pieceContainer.innerHTML = "";
    if (boardContainer) boardContainer.innerHTML = "";

    let pieces = [];
    let pieceId = 0;
    for (let r = 0; r < PUZZLE_ROWS; r++) {
        for (let c = 0; c < PUZZLE_COLS; c++) {
            let piece = document.createElement("div");
            piece.classList.add("puzzle-piece");
            piece.draggable = true;
            piece.dataset.id = pieceId;
            piece.style.backgroundImage = `url(${imageUrl})`;
            piece.style.backgroundSize = `${BOARD_WIDTH}px ${BOARD_HEIGHT}px`;
            let xPos = -(c * PIECE_WIDTH);
            let yPos = -(r * PIECE_HEIGHT);
            piece.style.backgroundPosition = `${xPos}px ${yPos}px`;
            piece.addEventListener("dragstart", dragStart);
            addDragDropListeners(piece);
            pieces.push(piece);
            let slot = document.createElement("div");
            slot.classList.add("board-slot");
            slot.dataset.id = pieceId; 
            addDragDropListeners(slot);
            boardContainer.appendChild(slot);
            pieceId++;
        }
    }
    pieces.sort(() => Math.random() - 0.5);
    pieces.forEach(piece => {
        if (pieceContainer) pieceContainer.appendChild(piece);
    });
    startTimer();
}

// --- TIMER FUNCTIONS ---
function startTimer() {
    stopTimer(); 
    timerStartTime = Date.now(); 
    timerInterval = setInterval(() => {
        const secondsElapsed = Math.floor((Date.now() - timerStartTime) / 1000);
        document.getElementById("timer").innerText = `Time: ${formatTime(secondsElapsed)}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${paddedMinutes}:${paddedSeconds}`;
}


// --- DRAG-AND-DROP FUNCTIONS ---
function addDragDropListeners(element) {
    element.addEventListener("dragover", dragOver);
    element.addEventListener("drop", drop);
}

function dragStart(event) {
    draggedPieceId = event.target.dataset.id;
    setTimeout(() => event.target.style.opacity = "0.5", 0);
    event.dataTransfer.setData("text/plain", event.target.dataset.id);
    event.stopPropagation();
}

function dragOver(event) {
    event.preventDefault(); 
}

function drop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const piece = document.querySelector(`.puzzle-piece[data-id='${draggedPieceId}']`);
    if (!piece) return;

    piece.style.opacity = "1";
    let dropTarget = event.target;
    const pieceContainer = document.getElementById("piece-container"); // Get container again

    if (dropTarget.classList.contains("puzzle-piece")) {
        if (pieceContainer) pieceContainer.appendChild(piece);
    }
    else if (dropTarget.id === "piece-container") {
        dropTarget.appendChild(piece);
    } 
    else if (dropTarget.classList.contains("board-slot")) {
        if (!dropTarget.hasChildNodes()) {
            dropTarget.appendChild(piece);
        }
    }
    checkWin();
}

/** Checks the win condition */
function checkWin() {
    const slots = document.querySelectorAll("#board-container .board-slot");
    let allCorrect = true;
    for (const slot of slots) {
        const piece = slot.firstChild;
        if (!piece || piece.dataset.id !== slot.dataset.id) {
            allCorrect = false;
            break;
        }
    }
    if (allCorrect) {
        stopTimer();
        finalTime = Math.floor((Date.now() - timerStartTime) / 1000); // <-- 'finalTime' is set here
        console.log(`User won! Final time: ${finalTime} seconds`); 
        document.getElementById("modal-final-time").innerText = `Your time: ${formatTime(finalTime)}`;
        document.getElementById("modal-overlay").style.display = "flex";
        
        // This is where you would put the leaderboard logic if you had it
        // e.g., submitScoreToLeaderboard(finalTime, connectedPublicKey);
    }
}

// === TX HISTORY FUNCTIONS ===

/**
 * Loads transaction history from localStorage and displays it.
 */
function loadTransactionHistory() {
    const historyPanel = document.getElementById("tx-history-panel");
    if (!historyPanel) return;

    historyPanel.innerHTML = "<h4>My Tx History</h4>"; // Clear old entries but keep title
    
    const history = JSON.parse(localStorage.getItem("txHistory")) || [];
    
    if (history.length === 0) {
        historyPanel.innerHTML += `<div class="tx-history-entry">No transactions yet.</div>`;
        return;
    }

    // Display in reverse order (newest first)
    history.reverse().forEach(signature => {
        const entryDiv = document.createElement("div");
        entryDiv.className = "tx-history-entry";
        
        const shortSig = signature.substring(0, 10) + "...";
        const explorerUrl = `https://explorer.testnet.carv.io/tx/${signature}`; // <-- UPDATED URL

        entryDiv.innerHTML = `<a href="${explorerUrl}" target="_blank">${shortSig}</a>`;
        historyPanel.appendChild(entryDiv);
    });
}

/**
 * Saves a new transaction signature to localStorage.
 * @param {string} signature - The transaction signature string.
 */
function saveTransactionToHistory(signature) {
    let history = JSON.parse(localStorage.getItem("txHistory")) || [];
    history.push(signature);
    
    // Optional: Keep only the last 5 transactions
    if (history.length > 5) {
        history = history.slice(history.length - 5);
    }
    
    localStorage.setItem("txHistory", JSON.stringify(history));
}

// === CHARITY PROGRESS BAR FUNCTION ===
async function updateCharityProgress() {
    const progressBar = document.getElementById("charity-progress-bar");
    const progressText = document.getElementById("charity-progress-text");

    if (!progressBar || !progressText) return;

    try {
        // Fetch the balance of the charity wallet
        const balance = await connection.getBalance(TREASURY_ADDRESS);
        const balanceInSol = balance / LAMPORTS_PER_SOL;

        // Calculate percentage
        let percent = (balanceInSol / CHARITY_GOAL_SOL) * 100;
        if (percent > 100) percent = 100; // Cap at 100%

        // Update the UI
        progressBar.style.width = `${percent}%`;
        progressText.innerText = `${percent.toFixed(1)}% (${balanceInSol.toFixed(4)} / ${CHARITY_GOAL_SOL} SOL)`;
        
        console.log(`Charity goal progress: ${percent.toFixed(1)}%`);

    } catch (err) {
        console.error("Failed to fetch charity wallet balance:", err);
        progressText.innerText = "Error loading progress";
    }
}