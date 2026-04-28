import { client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.js";

document.addEventListener('DOMContentLoaded', () => {
    console.log("SA-STYLE v2 Loaded");

    // UI Elements
    const bgUpload = document.getElementById('bg-upload');
    const topUpload = document.getElementById('top-upload');
    const bottomUpload = document.getElementById('bottom-upload');
    const userPhotoDisplay = document.getElementById('user-photo-display');
    const emptyMsg = document.getElementById('empty-msg');
    const aiTryOnBtn = document.getElementById('ai-tryon-btn');
    const aiLoader = document.getElementById('ai-loader');
    const resetBtn = document.getElementById('reset-btn');

    const selectionPreview = document.getElementById('selection-preview');
    const topPreviewBox = document.getElementById('top-preview-box');
    const topPreviewImg = document.getElementById('top-preview-img');
    const bottomPreviewBox = document.getElementById('bottom-preview-box');
    const bottomPreviewImg = document.getElementById('bottom-preview-img');

    // Camera Elements
    const cameraOpenBtn = document.getElementById('camera-open-btn');
    const cameraTopBtn = document.getElementById('camera-top-btn');
    const cameraBottomBtn = document.getElementById('camera-bottom-btn');
    const cameraModal = document.getElementById('camera-modal');
    const cameraVideo = document.getElementById('camera-video');
    const cameraCaptureBtn = document.getElementById('camera-capture-btn');
    const cameraCloseBtn = document.getElementById('camera-close-btn');
    const cameraFlipBtn = document.getElementById('camera-flip-btn');

    let humanData = null; 
    let topData = null; 
    let bottomData = null;

    // Utility: Show Toast Message
    const showToast = (msg) => {
        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:black; color:white; padding:10px 20px; border-radius:20px; z-index:10001; font-size:14px;";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    };

    // Utility: Convert File/Blob to Base64 (Data URL) for reliable display
    const toBase64 = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    // 1. Human Photo Upload
    bgUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            humanData = file;
            const url = URL.createObjectURL(file);
            userPhotoDisplay.src = url;
            userPhotoDisplay.style.display = 'block';
            emptyMsg.style.display = 'none';
            showToast("인물 사진이 등록되었습니다.");
            
            // Fallback for some mobile browsers
            setTimeout(async () => {
                if (!userPhotoDisplay.complete || userPhotoDisplay.naturalWidth === 0) {
                    const base64 = await toBase64(file);
                    userPhotoDisplay.src = base64;
                }
            }, 500);
        }
    });

    // Camera Logic
    let stream = null;
    let currentCameraTarget = 'human'; 
    let currentFacingMode = 'user'; 

    const startStream = async () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: currentFacingMode } 
            });
            cameraVideo.srcObject = stream;
            cameraVideo.play();
            cameraVideo.style.transform = (currentFacingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
        } catch (err) {
            alert('카메라 시작 실패: ' + err.message);
        }
    };

    const openCamera = async (target) => {
        currentCameraTarget = target;
        currentFacingMode = (target === 'human') ? 'user' : 'environment';
        cameraModal.style.display = 'flex';
        await startStream();
    };

    cameraOpenBtn.addEventListener('click', () => openCamera('human'));
    if (cameraTopBtn) cameraTopBtn.addEventListener('click', () => openCamera('top'));
    if (cameraBottomBtn) cameraBottomBtn.addEventListener('click', () => openCamera('bottom'));

    cameraFlipBtn.addEventListener('click', async () => {
        currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
        await startStream();
    });

    const closeCamera = () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        cameraModal.style.display = 'none';
    };

    cameraCloseBtn.addEventListener('click', closeCamera);

    cameraCaptureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        if (currentFacingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(cameraVideo, 0, 0);
        
        canvas.toBlob(async (blob) => {
            if (currentCameraTarget === 'human') {
                humanData = blob;
                const url = URL.createObjectURL(blob);
                userPhotoDisplay.src = url;
                userPhotoDisplay.style.display = 'block';
                emptyMsg.style.display = 'none';
                showToast("사진이 촬영되었습니다.");
                
                setTimeout(async () => {
                    if (!userPhotoDisplay.complete || userPhotoDisplay.naturalWidth === 0) {
                        userPhotoDisplay.src = await toBase64(blob);
                    }
                }, 500);
            } else {
                addGarmentToGrid(blob, currentCameraTarget);
            }
            closeCamera();
        }, 'image/jpeg', 0.9);
    });

    // 2. Garment Management
    const selectGarment = async (srcOrFile, category) => {
        selectionPreview.style.display = 'block';
        const displaySrc = (typeof srcOrFile === 'string') ? srcOrFile : await toBase64(srcOrFile);
        
        if (category === 'top') {
            topData = srcOrFile;
            topPreviewImg.src = displaySrc;
            topPreviewBox.style.display = 'block';
        } else {
            bottomData = srcOrFile;
            bottomPreviewImg.src = displaySrc;
            bottomPreviewBox.style.display = 'block';
        }
    };

    const addGarmentToGrid = async (srcOrFile, category) => {
        const grid = document.getElementById(`${category}-grid`);
        const displaySrc = (typeof srcOrFile === 'string') ? srcOrFile : await toBase64(srcOrFile);
        
        const newCard = document.createElement('div');
        newCard.className = 'item-card';
        newCard.innerHTML = `<img src="${displaySrc}">`;
        newCard.style.border = '2px solid transparent';
        
        newCard.addEventListener('click', () => {
            selectGarment(srcOrFile, category);
            grid.querySelectorAll('.item-card').forEach(c => c.style.borderColor = 'transparent');
            newCard.style.borderColor = 'var(--accent)';
        });
        
        grid.appendChild(newCard);
        showToast(category === 'top' ? "상의가 추가되었습니다." : "하의가 추가되었습니다.");
        newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    // Initial item click setup
    document.querySelectorAll('.item-card').forEach(card => {
        card.addEventListener('click', () => {
            const cat = card.dataset.category;
            const img = card.dataset.img;
            selectGarment(img, cat);
            card.parentElement.querySelectorAll('.item-card').forEach(c => c.style.borderColor = 'transparent');
            card.style.borderColor = 'var(--accent)';
        });
    });

    topUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) addGarmentToGrid(file, 'top');
    });

    bottomUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) addGarmentToGrid(file, 'bottom');
    });

    // 3. AI Magic
    aiTryOnBtn.addEventListener('click', async () => {
        if (!humanData || (!topData && !bottomData)) {
            alert('사진과 의상을 모두 선택해 주세요!');
            return;
        }
        aiLoader.style.display = 'flex';
        try {
            const app = await client("yisol/IDM-VTON");
            let currentImage = humanData;

            if (topData) {
                const res = await app.predict("/tryon", [
                    {"background": handle_file(currentImage), "layers": [], "composite": null},
                    handle_file(topData),
                    "High quality garment", true, false, 30, 42
                ]);
                if (res.data && res.data[0].url) currentImage = res.data[0].url;
            }

            if (bottomData) {
                const res = await app.predict("/tryon", [
                    {"background": handle_file(currentImage), "layers": [], "composite": null},
                    handle_file(bottomData),
                    "High quality garment", true, false, 30, 42
                ]);
                if (res.data && res.data[0].url) currentImage = res.data[0].url;
            }

            userPhotoDisplay.src = currentImage;
            showToast("피팅이 완료되었습니다!");
        } catch (err) {
            alert('AI 오류: ' + err.message);
        } finally {
            aiLoader.style.display = 'none';
        }
    });

    resetBtn.addEventListener('click', () => location.reload());

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js?v=2');
        });
    }
});
