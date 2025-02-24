import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import axios from "axios";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  Noise,
  Vignette,
  ToneMapping,
} from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";

const ModelViewer = ({ loading, params }) => {
  const [modelUrl, setModelUrl] = useState(null);
  useEffect(() => {
    axios
      .get(
        `http://127.0.0.1:8000/api/generate-model/?width=${params.width}&length=${params.length}&height=4&budget=${params.budget}`
      )
      .then((response) => {
        if (response.data.model_url) {
          setModelUrl(response.data.model_url);
        }
      })
      .catch((error) => console.error("Error fetching model:", error));
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", opacity: loading ? 0 : 1 }}>
      {modelUrl ? (
        <Canvas
          camera={{
            position: [15, 15, 15],
            fov: 45,
            near: 0.1,
            far: 1000,
          }}
          shadows
          gl={{ preserveDrawingBuffer: true }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[0, 5, -10]} intensity={0.5} />
          <spotLight
            position={[10, 15, 10]}
            angle={Math.PI / 8}
            penumbra={1}
            intensity={1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <Environment preset="apartment" />
          <Model url={modelUrl} />
          <OrbitControls
            minDistance={5}
            maxDistance={30}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2}
          />
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.001, 0]}
            receiveShadow
          >
            <planeGeometry args={[100, 100]} />
            <shadowMaterial opacity={0.4} />
          </mesh>
          <EffectComposer>
            <Bloom intensity={0.4} kernelSize={KernelSize.HUGE} />
            <DepthOfField
              focusDistance={0.02}
              focalLength={0.1}
              bokehScale={2}
            />
            <Noise opacity={0.1} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
            <ToneMapping />
          </EffectComposer>
        </Canvas>
      ) : (
        <p>Loading 3D Model...</p>
      )}
    </div>
  );
};

const Model = ({ url }) => {
  const { scene } = useGLTF(url, true, "draco");

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={1} />;
};

export default ModelViewer;
