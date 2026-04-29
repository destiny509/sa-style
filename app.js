import { client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.js";

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const bgUpload = document.getElementById('bg-upload');
    const topUpload = document.getElementById('top-upload');
    const bottomUpload = document.getElementById('bottom-upload');
    const userPhotoDisplay = document.getElementById('user-photo-display');
    const emptyMsg = document.getElementById('empty-msg');
    
    const selectionPreview = document.getElementById('selection-preview');
    const topPreviewBox = document.getElementById('top-preview-box');
    const topPreviewImg = document.getElementById('top-preview-img');
    const bottomPreviewBox = document.getElementById('bottom-preview-box');
    const bottomPreviewImg = document.getElementById('bottom-preview-img');

    const aiTryOnBtn = document.getElementById('ai-tryon-btn');
    const aiLoader = document.getElementById('ai-loader');

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

    const showToast = (msg) => {
        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:black; color:white; padding:10px 20px; border-radius:20px; z-index:10001; font-size:14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    };

    // 1. Step 1: Human Photo
    const updateHumanPhoto = (fileOrBlob) => {
        humanData = fileOrBlob;
        const url = URL.createObjectURL(fileOrBlob);
        userPhotoDisplay.src = url;
        userPhotoDisplay.style.display = 'block';
        if (emptyMsg) emptyMsg.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    bgUpload.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            updateHumanPhoto(e.target.files[0]);
            showToast("인물 사진이 등록되었습니다.");
        }
    });

    // Camera Logic
    let stream = null;
    let currentCameraTarget = 'human'; 
    let currentFacingMode = 'user'; 

    const startStream = async () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } });
            cameraVideo.srcObject = stream;
            cameraVideo.play();
            cameraVideo.style.transform = (currentFacingMode === 'user') ? 'scaleX(-1)' : 'scaleX(1)';
        } catch (err) {
            alert('카메라 접근 실패: ' + err.message);
        }
    };

    const openCamera = async (target) => {
        currentCameraTarget = target;
        currentFacingMode = (target === 'human') ? 'user' : 'environment';
        cameraModal.style.display = 'flex';
        await startStream();
    };

    if (cameraOpenBtn) cameraOpenBtn.addEventListener('click', () => openCamera('human'));
    if (cameraTopBtn) cameraTopBtn.addEventListener('click', () => openCamera('top'));
    if (cameraBottomBtn) cameraBottomBtn.addEventListener('click', () => openCamera('bottom'));

    if (cameraFlipBtn) {
        cameraFlipBtn.addEventListener('click', async () => {
            currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
            await startStream();
        });
    }

    cameraCloseBtn.addEventListener('click', () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        cameraModal.style.display = 'none';
    });

    cameraCaptureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        if (currentFacingMode === 'user') {
            ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
        }
        ctx.drawImage(cameraVideo, 0, 0);
        canvas.toBlob((blob) => {
            if (currentCameraTarget === 'human') {
                updateHumanPhoto(blob);
                showToast("사진이 촬영되었습니다.");
            } else {
                addGarmentToGrid(blob, currentCameraTarget);
                showToast("의상이 추가되었습니다.");
            }
            if (stream) stream.getTracks().forEach(track => track.stop());
            cameraModal.style.display = 'none';
        }, 'image/jpeg', 0.9);
    });

    // 2. Step 2 & 3: Selection
    const selectGarment = (srcOrFile, category) => {
        selectionPreview.style.display = 'block';
        const url = (typeof srcOrFile === 'string') ? srcOrFile : URL.createObjectURL(srcOrFile);
        if (category === 'top') {
            topData = srcOrFile;
            topPreviewImg.src = url;
            topPreviewBox.style.display = 'block';
        } else {
            bottomData = srcOrFile;
            bottomPreviewImg.src = url;
            bottomPreviewBox.style.display = 'block';
        }
    };

    const addGarmentToGrid = (file, category) => {
        const grid = document.getElementById(`${category}-grid`);
        const url = URL.createObjectURL(file);
        const newCard = document.createElement('div');
        newCard.className = 'item-card';
        newCard.innerHTML = `<img src="${url}">`;
        newCard.addEventListener('click', () => {
            selectGarment(file, category);
            grid.querySelectorAll('.item-card').forEach(c => c.style.borderColor = 'transparent');
            newCard.style.borderColor = 'var(--accent)';
        });
        grid.appendChild(newCard);
        newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    document.querySelectorAll('.item-card').forEach(card => {
        card.addEventListener('click', () => {
            const cat = card.dataset.category;
            const img = card.dataset.img;
            selectGarment(img, cat);
            card.parentElement.querySelectorAll('.item-card').forEach(c => c.style.borderColor = 'transparent');
            card.style.borderColor = 'var(--accent)';
        });
    });

    topUpload.addEventListener('change', (e) => { if (e.target.files[0]) addGarmentToGrid(e.target.files[0], 'top'); });
    bottomUpload.addEventListener('change', (e) => { if (e.target.files[0]) addGarmentToGrid(e.target.files[0], 'bottom'); });

    // 3. AI Action
    aiTryOnBtn.addEventListener('click', async () => {
        if (!humanData || (!topData && !bottomData)) {
            alert('사진과 의상을 모두 선택해 주세요!');
            return;
        }

        const userPrompt = document.getElementById('ai-prompt').value || "High quality garment";
        aiLoader.style.display = 'flex';
        const loaderText = aiLoader.querySelector('p');
        
        try {
            const app = await client("yisol/IDM-VTON");
            let currentImage = humanData;

            if (topData) {
                loaderText.innerText = "상의 피팅 중... (지시어 반영 중)";
                const res = await app.predict("/tryon", [
                    {"background": handle_file(currentImage), "layers": [], "composite": null},
                    handle_file(topData), 
                    userPrompt, // 사용자 프롬프트 반영
                    true, false, 30, 42
                ]);
                if (res.data && res.data[0].url) {
                    currentImage = res.data[0].url;
                    userPhotoDisplay.src = currentImage;
                }
            }

            if (bottomData) {
                loaderText.innerText = "하의 피팅 중... (지시어 반영 중)";
                const res = await app.predict("/tryon", [
                    {"background": handle_file(currentImage), "layers": [], "composite": null},
                    handle_file(bottomData), 
                    userPrompt, // 사용자 프롬프트 반영
                    true, false, 30, 42
                ]);
                if (res.data && res.data[0].url) {
                    userPhotoDisplay.src = res.data[0].url;
                }
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast("AI 지시어가 반영된 피팅이 완료되었습니다!");
        } catch (err) {
            alert('AI 오류: ' + err.message);
        } finally {
            aiLoader.style.display = 'none';
        }
    });

    document.getElementById('reset-btn').addEventListener('click', () => location.reload());
});
