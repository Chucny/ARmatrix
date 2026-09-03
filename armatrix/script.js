let activeEntity = null;

    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 500);
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0); 
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 10, 4);
    scene.add(dirLight);

    const gltfLoader = new THREE.GLTFLoader();

    function loadNormalizedGLTF(url, callback, fallbackUrl = null) {
      gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          
          if (maxDim > 0) {
            const scaleFactor = 1.0 / maxDim;
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);
          }
          callback(model);
        },
        undefined,
        (err) => { 
          console.error("Error loading model:", err);
          if (fallbackUrl && url !== fallbackUrl) {
            loadNormalizedGLTF(fallbackUrl, callback, null);
          }
        }
      );
    }

    const videoElement = document.getElementById('webcam');

    async function initWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
          videoElement.play();
        };
      } catch (err) {
        console.warn("Camera feed could not be started:", err);
      }
    }

    const euler = new THREE.Euler();
    const deviceQuaternion = new THREE.Quaternion();
    const screenTransform = new THREE.Quaternion();
    const worldTransform = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

    function handleOrientation(event) {
      const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
      const beta  = event.beta  ? THREE.MathUtils.degToRad(event.beta)  : 0;
      const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;
      const orient = window.orientation ? THREE.MathUtils.degToRad(window.orientation) : 0;

      euler.set(beta, alpha, -gamma, 'YXZ');
      deviceQuaternion.setFromEuler(euler);
      screenTransform.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient);

      camera.quaternion.copy(deviceQuaternion);
      camera.quaternion.multiply(worldTransform);
      camera.quaternion.multiply(screenTransform);
    }

    async function initSensors() {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        } catch (err) { console.error("Sensor permission error:", err); }
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
      await initWebcam();
    }

    // an ideal y floor can be around -1.5

    function spawnModel(url, dist, ang, y_floor, rotation_a) {
      if (activeEntity) {
        scene.remove(activeEntity.mesh);
      }

      loadNormalizedGLTF(url, (mesh) => {
        const distance = dist; 
        const angle = ang;

        const x = Math.sin(angle) * distance;
        const z = -Math.cos(angle) * distance;
        const y = y_floor; 

        mesh.position.set(camera.position.x + x, y, camera.position.z + z);
        mesh.rotation.y = rotation_a;

        scene.add(mesh);

        activeEntity = {
          mesh: mesh,
          url: url
        };
        console.log(`Model successfully loaded from: ${url}`);
      });
    }

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.getElementById('start-btn').addEventListener('click', async () => {
      document.getElementById('overlay').style.display = 'none';
      await initSensors();
      animate();

     
    });
