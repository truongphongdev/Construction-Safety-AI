import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CameraItem } from '@/pages/Cameras/CameraCard';

interface VideoCacheItem {
  blobUrl: string;
  fileName: string;
  file?: File;
}

interface CameraMediaContextType {
  uploadedVideos: Record<string, VideoCacheItem>;
  customCameras: CameraItem[];
  saveCameraVideo: (camId: string, file: File) => void;
  removeCameraVideo: (camId: string) => void;
  addCustomCamera: (cam: CameraItem) => void;
  removeCustomCamera: (camId: string) => void;
}

const DB_NAME = 'ConstructionSafetyMediaDB';
const STORE_NAME = 'camera_videos';

function openVideoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'camId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeVideoBlobInDB(camId: string, file: File, fileName: string): Promise<void> {
  try {
    const db = await openVideoDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ camId, file, fileName, updatedAt: Date.now() });
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('Không thể lưu video vào IndexedDB:', err);
  }
}

async function loadAllVideoBlobsFromDB(): Promise<Record<string, { file: File; fileName: string }>> {
  try {
    const db = await openVideoDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = request.result || [];
        const map: Record<string, { file: File; fileName: string }> = {};
        for (const item of results) {
          if (item.camId && item.file) {
            map[item.camId] = { file: item.file, fileName: item.fileName || 'video.mp4' };
          }
        }
        resolve(map);
      };
      request.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

async function removeVideoBlobFromDB(camId: string): Promise<void> {
  try {
    const db = await openVideoDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(camId);
  } catch (err) {
    console.warn('Không thể xóa video từ IndexedDB:', err);
  }
}

const CameraMediaContext = createContext<CameraMediaContextType | undefined>(undefined);

export function CameraMediaProvider({ children }: { children: React.ReactNode }) {
  const [uploadedVideos, setUploadedVideos] = useState<Record<string, VideoCacheItem>>({});
  const [customCameras, setCustomCameras] = useState<CameraItem[]>(() => {
    try {
      const saved = localStorage.getItem('custom_added_cameras');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Restore uploaded videos from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;
    loadAllVideoBlobsFromDB().then((cached) => {
      if (!isMounted) return;
      setUploadedVideos((prev) => {
        const next = { ...prev };
        for (const [camId, data] of Object.entries(cached)) {
          if (!next[camId]) {
            next[camId] = {
              blobUrl: URL.createObjectURL(data.file),
              fileName: data.fileName,
              file: data.file,
            };
          }
        }
        return next;
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const saveCameraVideo = useCallback((camId: string, file: File) => {
    const blobUrl = URL.createObjectURL(file);
    setUploadedVideos((prev) => {
      // Revoke old blob URL if any
      if (prev[camId]?.blobUrl) {
        URL.revokeObjectURL(prev[camId].blobUrl);
      }
      return {
        ...prev,
        [camId]: {
          blobUrl,
          fileName: file.name,
          file,
        },
      };
    });
    storeVideoBlobInDB(camId, file, file.name);
  }, []);

  const removeCameraVideo = useCallback((camId: string) => {
    setUploadedVideos((prev) => {
      if (prev[camId]?.blobUrl) {
        URL.revokeObjectURL(prev[camId].blobUrl);
      }
      const copy = { ...prev };
      delete copy[camId];
      return copy;
    });
    removeVideoBlobFromDB(camId);
  }, []);

  const addCustomCamera = useCallback((cam: CameraItem) => {
    setCustomCameras((prev) => {
      const next = [...prev.filter((c) => c.id !== cam.id), cam];
      try {
        localStorage.setItem('custom_added_cameras', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const removeCustomCamera = useCallback((camId: string) => {
    setCustomCameras((prev) => {
      const next = prev.filter((c) => c.id !== camId);
      try {
        localStorage.setItem('custom_added_cameras', JSON.stringify(next));
      } catch {}
      return next;
    });
    removeCameraVideo(camId);
  }, [removeCameraVideo]);

  return (
    <CameraMediaContext.Provider
      value={{
        uploadedVideos,
        customCameras,
        saveCameraVideo,
        removeCameraVideo,
        addCustomCamera,
        removeCustomCamera,
      }}
    >
      {children}
    </CameraMediaContext.Provider>
  );
}

export function useCameraMedia() {
  const ctx = useContext(CameraMediaContext);
  if (!ctx) {
    throw new Error('useCameraMedia must be used within a CameraMediaProvider');
  }
  return ctx;
}
