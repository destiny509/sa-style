import { client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.js";

document.addEventListener('DOMContentLoaded', () => {
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

    // Data Store
    let humanData = null; 
    let topData = null; 
    let bottomData = null;

    // Camera UI Elements
    const cameraOpenBtn = document.getElementById('camera-open-btn');
    const cameraModal = document.getElementById('camera-modal');
    const cameraVideo = document.getElementById('camera-video');
    const cameraCaptureBtn = document.getElementById('camera-capture-btn');
    const cameraCloseBtn = document.getElementById('camera-close-btn');
    const cameraFlipBtn = document.getElementById('camera-flip-btn');

    // 1. Human Photo Upload (Album)
    bgUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            humanData = file;
            userPhotoDisplay.src = URL.createObjectURL(file);
            userPhotoDisplay.style.display = 'block';
            emptyMsg.style.display = 'none';
        }
    });

    // 1-1. Camera Functionality (Enhanced)
    let stream = null;
    let currentCameraTarget = 'human'; 
    let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)

    const openCamera = async (target) => {
        currentCameraTarget = target;
        // Default to front for human, back for garments
        currentFacingMode = target === 'human' ? 'user' : 'environment';
        await startStream();
        cameraModal.style.display = 'flex';
    };

    const startStream = async () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            cameraVideo.srcObject = stream;
            // Mirror only for front camera
            cameraVideo.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
        } catch (err) {
            alert('카메라 시작 실패: ' + err.message);
        }
    };

    cameraFlipBtn.addEventListener('click', async () => {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        await startStream();
    });

    cameraOpenBtn.addEventListener('click', () => openCamera('human'));
    
    // Explicitly select all triggers including those in Step 2 & 3
    document.querySelectorAll('.camera-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openCamera(btn.dataset.target);
        });
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
        
        // Mirror the captured image if using front camera
        if (currentFacingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(cameraVideo, 0, 0);
        
        canvas.toBlob((blob) => {
            if (currentCameraTarget === 'human') {
                humanData = blob;
                userPhotoDisplay.src = URL.createObjectURL(blob);
                userPhotoDisplay.style.display = 'block';
                emptyMsg.style.display = 'none';
            } else {
                selectGarment(blob, currentCameraTarget);
            }
            closeCamera();
        }, 'image/jpeg', 0.9);
    });

    // 2. Garment Selection Handlers
    const selectGarment = (srcOrFile, category) => {
        selectionPreview.style.display = 'block';
        if (category === 'top') {
            topData = srcOrFile;
            topPreviewImg.src = (typeof srcOrFile === 'string') ? srcOrFile : URL.createObjectURL(srcOrFile);
            topPreviewBox.style.display = 'block';
        } else {
            bottomData = srcOrFile;
            bottomPreviewImg.src = (typeof srcOrFile === 'string') ? srcOrFile : URL.createObjectURL(srcOrFile);
            bottomPreviewBox.style.display = 'block';
        }
    };

    document.querySelectorAll('.item-card').forEach(card => {
        card.addEventListener('click', () => {
            selectGarment(card.dataset.img, card.dataset.category);
        });
    });

    topUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) selectGarment(file, 'top');
    });

    bottomUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) selectGarment(file, 'bottom');
    });

    // 3. Sequential AI Try-On Logic
    aiTryOnBtn.addEventListener('click', async () => {
        if (!humanData || (!topData && !bottomData)) {
            alert('사진과 의상(상의 혹은 하의)을 준비해 주세요!');
            return;
        }

        aiLoader.style.display = 'flex';
        const loaderText = aiLoader.querySelector('p');
        
        try {
            const app = await client("yisol/IDM-VTON");
            let currentImage = humanData;

            // Step 1: Fit Top
            if (topData) {
                loaderText.innerHTML = "상의(Top) 피팅 중...<br><span style='font-size:0.8rem;'>첫 번째 레이어를 생성하고 있습니다.</span>";
                const res = await app.predict("/tryon", [
                    {"background": handle_file(currentImage), "layers": [], "composite": null},
                    handle_file(topData),
                    "High quality top garment try-on",
                    true, false, 30, 42
                ]);
                
                if (res.data && res.data[0] && res.data[0].url) {
                    currentImage = res.data[0].url; // Use URL as next input
                    userPhotoDisplay.src = currentImage; // Preview intermediate result
                } else {
                    throw new Error("상의 피팅 중 오류가 발생했습니다.");
                }
            }

            // Step 2: Fit Bottom
            if (bottomData) {
                loaderText.innerHTML = "하의(Bottom) 피팅 중...<br><span style='font-size:0.8rem;'>두 번째 레이어를 생성하고 있습니다.</span>";
                const res = await app.predict("/tryon", [
                    {"background": handle_file(currentImage), "layers": [], "composite": null},
                    handle_file(bottomData),
                    "High quality bottom garment try-on",
                    true, false, 30, 42
                ]);
                
                if (res.data && res.data[0] && res.data[0].url) {
                    userPhotoDisplay.src = res.data[0].url;
                } else {
                    throw new Error("하의 피팅 중 오류가 발생했습니다.");
                }
            }

            alert('모든 의상 피팅이 완료되었습니다!');
            
        } catch (err) {
            console.error(err);
            alert(`[AI 피팅 실패] ${err.message}\n\n잠시 후 다시 시도해 주세요.`);
        } finally {
            aiLoader.style.display = 'none';
            loaderText.innerHTML = "진짜 입은 것처럼 새롭게 이미지를 그리고 있습니다.<br><span style='font-size: 0.8rem;'>(최대 1~2분 정도 소요될 수 있습니다)</span>";
        }
    });

    resetBtn.addEventListener('click', () => location.reload());

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(reg => {
                console.log('Service Worker Registered');
            }).catch(err => {
                console.log('Service Worker Registration Failed', err);
            });
        });
    }
});
