class ImageEditor {
    constructor() {
        this.images = [];
        this.currentImageIndex = -1;
        this.cropper = null;
        this.aspectRatio = 1;
        this.isProcessing = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateStats();
        this.updateEditPanelStatus();
    }

    setupEventListeners() {
        // 上传区域事件
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));

        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 图片列表事件
        document.getElementById('imageList').addEventListener('click', this.handleImageClick.bind(this));

        // 模板选择事件
        document.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', this.handleTemplateSelect.bind(this));
        });

        // 尺寸调整事件
        document.getElementById('widthInput').addEventListener('input', this.handleWidthChange.bind(this));
        document.getElementById('heightInput').addEventListener('input', this.handleHeightChange.bind(this));
        document.getElementById('keepRatio').addEventListener('change', this.handleRatioToggle.bind(this));

        // 裁剪控制事件
        document.getElementById('rotateLeft').addEventListener('click', () => this.rotate(-90));
        document.getElementById('rotateRight').addEventListener('click', () => this.rotate(90));
        document.getElementById('flipHorizontal').addEventListener('click', () => this.flip('horizontal'));
        document.getElementById('flipVertical').addEventListener('click', () => this.flip('vertical'));
        document.getElementById('resetCrop').addEventListener('click', () => this.resetCrop());

        // 导出事件
        document.getElementById('exportSingle').addEventListener('click', () => this.exportImage());
        document.getElementById('exportBatch').addEventListener('click', () => this.exportBatch());
    }

    handleDragOver(e) {
        e.preventDefault();
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.classList.remove('dragover');

        this.processFiles(e.dataTransfer.files);
    }

    handleFileSelect(e) {
        this.processFiles(e.target.files);
    }

    processFiles(files) {
        const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

        if (validFiles.length === 0) {
            this.showToast('请选择有效的图片文件', 'error');
            return;
        }

        if (validFiles.length > 50) {
            this.showToast('最多支持上传50张图片', 'error');
            return;
        }

        // 显示加载动画
        this.showLoading('正在上传图片...');

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.images.push({
                        file: file,
                        image: img,
                        src: e.target.result
                    });
                    this.updateImageList();
                    this.updateStats();

                    // 加载完成后隐藏加载动画
                    if (validFiles.length === this.images.length) {
                        this.hideLoading();
                        this.showToast(`成功上传 ${validFiles.length} 张图片`, 'success');
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    updateImageList() {
        const imageList = document.getElementById('imageList');
        imageList.innerHTML = '';

        this.images.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'image-item';
            div.innerHTML = `
                <img src="${item.src}" alt="图片${index + 1}">
                <button class="remove-btn" data-index="${index}">×</button>
            `;
            imageList.appendChild(div);
        });

        document.getElementById('imageListSection').style.display = 'block';

        // 移除按钮事件
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.removeImage(index);
            });
        });

        if (this.images.length === 1) {
            this.selectImage(0);
        }
    }

    handleImageClick(e) {
        const imageItem = e.target.closest('.image-item');
        if (!imageItem) return;

        const index = Array.from(imageItem.parentNode.children).indexOf(imageItem);
        this.selectImage(index);
    }

    selectImage(index) {
        // 移除之前的选中状态
        document.querySelectorAll('.image-item').forEach(item => {
            item.classList.remove('selected');
        });

        // 添加新的选中状态
        document.querySelectorAll('.image-item')[index].classList.add('selected');

        this.currentImageIndex = index;
        this.loadImageToCropper();
        this.updateEditPanelStatus();
    }

    removeImage(index) {
        const removedFile = this.images[index].file.name;
        this.images.splice(index, 1);
        this.updateImageList();
        this.updateStats();

        if (this.currentImageIndex === index) {
            if (this.images.length > 0) {
                this.selectImage(Math.min(index, this.images.length - 1));
            } else {
                this.currentImageIndex = -1;
                this.updateEditPanelStatus();
            }
        } else if (this.currentImageIndex > index) {
            this.currentImageIndex--;
        }

        this.showToast(`已删除图片: ${removedFile}`, 'success');
    }

    loadImageToCropper() {
        if (this.currentImageIndex < 0 || this.currentImageIndex >= this.images.length) return;

        const item = this.images[this.currentImageIndex];
        const img = document.getElementById('editImage');
        img.src = item.src;

        // 销毁之前的裁剪实例
        if (this.cropper) {
            this.cropper.destroy();
        }

        // 初始化裁剪器
        this.cropper = new Cropper(img, {
            aspectRatio: this.aspectRatio,
            viewMode: 1,
            dragMode: 'move',
            cropBoxMovable: true,
            cropBoxResizable: true,
            background: true,
            autoCropArea: 0.8
        });

        // 保留当前设置的尺寸，不重置为原图尺寸
        // 更新编辑信息
        this.updateEditInfo(item);
    }

    updateEditInfo(item) {
        document.getElementById('originalSize').textContent = `${item.image.width} × ${item.image.height}`;
        document.getElementById('currentSize').textContent = `${document.getElementById('widthInput').value} × ${document.getElementById('heightInput').value}`;
        document.getElementById('fileFormat').textContent = item.file.type.split('/')[1].toUpperCase();
    }

    handleTemplateSelect(e) {
        const item = e.target.closest('.template-item');
        if (!item) return;

        // 移除之前的选中状态
        document.querySelectorAll('.template-item').forEach(template => {
            template.classList.remove('selected');
        });

        // 添加新的选中状态
        item.classList.add('selected');

        const width = parseInt(item.dataset.width);
        const height = parseInt(item.dataset.height);

        document.getElementById('widthInput').value = width;
        document.getElementById('heightInput').value = height;
        this.aspectRatio = width / height;

        // 更新裁剪器的比例
        if (this.cropper) {
            this.cropper.setAspectRatio(this.aspectRatio);
        }

        // 更新当前尺寸显示
        if (this.currentImageIndex >= 0) {
            document.getElementById('currentSize').textContent = `${width} × ${height}`;
        }

        this.showToast(`已应用模板: ${item.getAttribute('title')}`, 'success');
    }

    handleWidthChange(e) {
        const width = parseInt(e.target.value);
        if (document.getElementById('keepRatio').checked) {
            const height = Math.round(width / this.aspectRatio);
            document.getElementById('heightInput').value = height;
        }

        // 更新当前尺寸显示
        if (this.currentImageIndex >= 0) {
            document.getElementById('currentSize').textContent = `${width} × ${document.getElementById('heightInput').value}`;
        }
    }

    handleHeightChange(e) {
        const height = parseInt(e.target.value);
        if (document.getElementById('keepRatio').checked) {
            const width = Math.round(height * this.aspectRatio);
            document.getElementById('widthInput').value = width;
        }

        // 更新当前尺寸显示
        if (this.currentImageIndex >= 0) {
            document.getElementById('currentSize').textContent = `${document.getElementById('widthInput').value} × ${height}`;
        }
    }

    handleRatioToggle(e) {
        if (e.target.checked && this.images.length > 0) {
            const item = this.images[this.currentImageIndex];
            this.aspectRatio = item.image.width / item.image.height;
            this.handleWidthChange({ target: document.getElementById('widthInput') });
            if (this.cropper) {
                this.cropper.setAspectRatio(this.aspectRatio);
            }
        } else {
            if (this.cropper) {
                this.cropper.setAspectRatio(NaN); // 自由比例
            }
        }
    }

    rotate(angle) {
        if (!this.cropper) return;
        this.cropper.rotate(angle);
    }

    flip(direction) {
        if (!this.cropper) return;
        if (direction === 'horizontal') {
            this.cropper.scaleX(this.cropper.getData().scaleX * -1);
        } else {
            this.cropper.scaleY(this.cropper.getData().scaleY * -1);
        }
    }

    resetCrop() {
        if (!this.cropper) return;
        this.cropper.reset();
        this.showToast('裁剪已重置', 'success');
    }

    exportImage() {
        if (!this.cropper || this.currentImageIndex < 0) {
            this.showToast('请先选择一张图片进行编辑', 'error');
            return;
        }

        this.showLoading('正在导出图片...');

        // 获取尺寸
        const width = parseInt(document.getElementById('widthInput').value);
        const height = parseInt(document.getElementById('heightInput').value);

        // 获取裁剪后的图片
        const canvas = this.cropper.getCroppedCanvas({
            width: width,
            height: height,
            minWidth: 100,
            minHeight: 100,
            maxWidth: 5000,
            maxHeight: 5000,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

        // 下载
        const link = document.createElement('a');
        link.download = `edited_${this.images[this.currentImageIndex].file.name}`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        this.hideLoading();
        this.showToast('图片导出成功', 'success');
    }

    exportBatch() {
        if (this.images.length === 0) {
            this.showToast('请先上传图片', 'error');
            return;
        }

        this.showLoading('正在批量导出图片...');

        // 获取当前设置的尺寸
        const targetWidth = parseInt(document.getElementById('widthInput').value);
        const targetHeight = parseInt(document.getElementById('heightInput').value);
        const targetAspectRatio = targetWidth / targetHeight;

        // 逐张处理图片，避免同时创建多个实例导致卡住
        let processedCount = 0;

        const processNextImage = () => {
            if (processedCount >= this.images.length) {
                this.hideLoading();
                this.showToast(`批量导出完成！共导出 ${this.images.length} 张图片`, 'success');
                return;
            }

            const item = this.images[processedCount];
            const index = processedCount;
            processedCount++;

            // 使用 Canvas 直接绘制图片，避免创建临时 Cropper 实例
            const tempImg = new Image();
            tempImg.src = item.src;
            tempImg.onload = () => {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');

                // 设置目标尺寸
                tempCanvas.width = targetWidth;
                tempCanvas.height = targetHeight;

                // 计算绘制区域
                const imgAspectRatio = tempImg.width / tempImg.height;
                let drawWidth, drawHeight, drawX, drawY;

                if (imgAspectRatio > targetAspectRatio) {
                    // 图片较宽，按高度缩放
                    drawHeight = tempCanvas.height;
                    drawWidth = tempCanvas.height * imgAspectRatio;
                    drawX = (tempCanvas.width - drawWidth) / 2;
                    drawY = 0;
                } else {
                    // 图片较高，按宽度缩放
                    drawWidth = tempCanvas.width;
                    drawHeight = tempCanvas.width / imgAspectRatio;
                    drawX = 0;
                    drawY = (tempCanvas.height - drawHeight) / 2;
                }

                // 绘制图片
                tempCtx.drawImage(
                    tempImg,
                    drawX, drawY, drawWidth, drawHeight
                );

                // 下载
                const link = document.createElement('a');
                link.download = `batch_${index + 1}_${item.file.name}`;
                link.href = tempCanvas.toDataURL('image/png');
                link.click();

                // 继续处理下一张图片
                setTimeout(processNextImage, 100); // 100ms 间隔避免阻塞
            };

            tempImg.onerror = () => {
                console.error(`Failed to load image: ${item.file.name}`);
                setTimeout(processNextImage, 100); // 继续处理下一张
            };
        };

        // 开始处理第一张图片
        processNextImage();
    }

    updateStats() {
        document.getElementById('uploadCount').textContent = this.images.length;
        document.getElementById('imageCount').textContent = this.images.length;
    }

    updateEditPanelStatus() {
        const editPanel = document.getElementById('editPanel');
        const editStatus = document.getElementById('editStatus');
        const statusText = editStatus.querySelector('.status-text');

        if (this.currentImageIndex >= 0 && this.images.length > 0) {
            statusText.textContent = `正在编辑: ${this.images[this.currentImageIndex].file.name}`;
        } else {
            statusText.textContent = '请先选择一张图片开始编辑';
        }
    }

    showLoading(text = '正在处理...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = loadingOverlay.querySelector('.loading-spinner p');
        loadingText.textContent = text;
        loadingOverlay.classList.add('active');
        this.isProcessing = true;
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.classList.remove('active');
        this.isProcessing = false;
    }

    showToast(text, type = 'success') {
        const toast = document.getElementById('toast');
        const toastText = document.getElementById('toastText');
        const toastIcon = document.getElementById('toastIcon');

        // 设置文本和类型
        toastText.textContent = text;
        toast.className = `toast ${type}`;

        // 设置图标
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        toastIcon.textContent = icons[type] || '✅';

        // 显示 toast
        toast.classList.add('active');

        // 3秒后自动隐藏
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new ImageEditor();
});