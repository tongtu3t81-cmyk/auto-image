
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

declare global {
  interface Window {
    electronAPI?: {
      saveImage: (payload: { dataUrl: string; defaultFileName: string }) => Promise<{
        canceled: boolean;
        filePath?: string;
        error?: string;
      }>;
    };
  }
}

interface PromptItem {
  stt: string;
  text: string;
}

interface ResultItem {
  stt: string;
  variant: number;
  imageUrl: string;
  prompt: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
}

const KHUNG_HINH: Record<string, string> = {
  '16:9': 'Ngang (16:9)',
  '9:16': 'Dọc (9:16)',
  '1:1': 'Vuông (1:1)',
  '4:3': 'Ngang 4:3',
  '3:4': 'Dọc 3:4',
};

const PHONG_CACH: Record<string, string> = {
  'none': 'Mặc định',
  'photorealistic': 'Nhiếp ảnh (Siêu thực)',
  'cinematic': 'Điện ảnh',
  'anime': 'Hoạt hình Anime',
  'watercolor': 'Tranh màu nước',
  'oil painting': 'Tranh sơn dầu',
  'fantasy': 'Giả tưởng',
  'steampunk': 'Steampunk',
  'cyberpunk': 'Cyberpunk',
  'line art': 'Nét vẽ',
  'pixel art': 'Nghệ thuật Pixel',
  '3d model': 'Mô hình 3D',
};


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Sẵn sàng');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9');
  const [selectedStyle, setSelectedStyle] = useState('none');

  const isRunningRef = useRef(isRunning);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini-api-key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    setLogs(prev => [...prev, { timestamp, message }]);
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      const key = apiKeyInput.trim();
      localStorage.setItem('gemini-api-key', key);
      setApiKey(key);
      alert("API Key đã được lưu thành công!");
    } else {
      alert("Vui lòng nhập API Key.");
    }
  };

  const handleChangeApiKey = () => {
    if (isRunning) {
        alert("Vui lòng dừng quá trình tạo ảnh trước khi thay đổi API Key.");
        return;
    }
    if (window.confirm("Bạn có chắc muốn thay đổi API Key không?")) {
      localStorage.removeItem('gemini-api-key');
      setApiKey(null);
      setApiKeyInput('');
    }
  };


  const handleGenerate = async () => {
    if (!apiKey) {
      alert("Vui lòng thiết lập API Key trước khi tạo ảnh.");
      return;
    }

    isRunningRef.current = true;
    setIsRunning(true);
    
    const parsedPrompts: PromptItem[] = promptInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes(','))
      .map(line => {
        const [stt, ...rest] = line.split(',');
        return { stt: stt.trim(), text: rest.join(',').trim() };
      })
      .filter(item => item.stt && item.text);

    if (parsedPrompts.length === 0) {
      addLog("❌ Lỗi: Không tìm thấy prompt hợp lệ. Vui lòng kiểm tra định dạng.");
      isRunningRef.current = false;
      setIsRunning(false);
      return;
    }
    
    setResults([]);
    setLogs([]);
    setProgress(0);
    addLog(`🚀 Bắt đầu quá trình tạo ảnh với ${parsedPrompts.length} prompts...`);

    let processedCount = 0;

    for (const prompt of parsedPrompts) {
      if (!isRunningRef.current) {
        addLog('⏹️ Quá trình đã được người dùng dừng lại.');
        break;
      }

      const finalPromptText = [
        prompt.text,
        selectedStyle !== 'none' ? selectedStyle : '',
      ].filter(Boolean).join(', ');
      
      setStatus(`Đang xử lý STT: ${prompt.stt}`);
      addLog(`🎯 Bắt đầu xử lý STT ${prompt.stt}: "${finalPromptText}"`);

      try {
        const ai = new GoogleGenAI({ apiKey: apiKey as string });
        
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: finalPromptText,
            config: {
              numberOfImages: 2,
              outputMimeType: 'image/jpeg',
              aspectRatio: selectedAspectRatio as '1:1' | '16:9' | '9:16' | '4:3' | '3:4',
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            response.generatedImages.forEach((image, index) => {
                const base64ImageBytes: string = image.image.imageBytes;
                const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                setResults(prev => [...prev, { stt: prompt.stt, variant: index + 1, imageUrl, prompt: finalPromptText }]);
            });
            addLog(`✅ STT ${prompt.stt}: Tạo thành công ${response.generatedImages.length} ảnh!`);
        } else {
             throw new Error("Không tìm thấy dữ liệu ảnh trong phản hồi từ model Imagen.");
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog(`❌ STT ${prompt.stt}: Lỗi! ${errorMessage}`);
      } finally {
        processedCount++;
        setProgress((processedCount / parsedPrompts.length) * 100);
      }

      // Thêm khoảng chờ để tránh bị giới hạn tần suất API
      if (isRunningRef.current && processedCount < parsedPrompts.length) {
        addLog(`⏳ Chờ 1 giây để tránh giới hạn API...`);
        await sleep(1000); // Đợi 1 giây
      }
    }
    
    addLog("🎉 Hoàn thành!");
    setStatus(`Hoàn thành ${processedCount}/${parsedPrompts.length} prompts`);
    isRunningRef.current = false;
    setIsRunning(false);
  };

  const handleStop = () => {
    isRunningRef.current = false;
    setIsRunning(false);
  };

  const handleDownload = async (stt: string, variant: number, imageUrl: string) => {
    if (window.electronAPI?.saveImage) {
      try {
        const result = await window.electronAPI.saveImage({
          dataUrl: imageUrl,
          defaultFileName: `${stt}-${variant}.jpeg`,
        });

        if (result?.canceled) {
          addLog(`⚠️ Đã hủy lưu ảnh ${stt}-${variant}.`);
        } else if (result?.error) {
          addLog(`❌ Không thể lưu ảnh ${stt}-${variant}: ${result.error}`);
        } else if (result?.filePath) {
          addLog(`💾 Đã lưu ảnh ${stt}-${variant} tại ${result.filePath}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addLog(`❌ Lỗi khi lưu ảnh ${stt}-${variant}: ${message}`);
        alert(`Không thể lưu ảnh: ${message}`);
      }
      return;
    }

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${stt}-${variant}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (!apiKey) {
    return (
      <div className="api-key-setup-container">
        <div className="api-key-form panel">
            <h2 className="panel-header">🔑 Thiết lập API Key</h2>
            <p className="panel-description">
                Để sử dụng ứng dụng, bạn cần cung cấp API Key của Google Gemini.
            </p>
            <label htmlFor="api-key-input">API Key của bạn:</label>
            <input 
                id="api-key-input"
                type="password" 
                className="api-key-input"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="Nhập API Key của bạn tại đây"
            />
            <button className="btn btn-primary" onClick={handleSaveApiKey}>
                Lưu và Bắt đầu
            </button>
            <p className="api-key-guide">
                Bạn có thể lấy API Key miễn phí từ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.
            </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="app-container">
      <div className="panel input-panel">
        <div className="panel-header-container">
            <h2 className="panel-header">🚀 Auto Whisk Web</h2>
            <button onClick={handleChangeApiKey} className="btn-change-key" title="Thay đổi API Key">🔑</button>
        </div>
        <p className="panel-description">
          Dán danh sách prompt từ Excel vào ô dưới đây. Mỗi dòng phải có định dạng: <b>STT, Nội dung prompt</b>
        </p>
        <textarea
          className="prompt-textarea"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="1, Một con mèo phi hành gia trên mặt trăng&#10;2, Rừng rậm nhiệt đới với thác nước ẩn&#10;3, Thành phố tương lai vào lúc hoàng hôn"
          disabled={isRunning}
        />
        <div className="options-container">
            <div className="option-group">
                <label htmlFor="aspect-ratio-select">Khung hình:</label>
                <select 
                    id="aspect-ratio-select"
                    className="option-select"
                    value={selectedAspectRatio}
                    onChange={e => setSelectedAspectRatio(e.target.value)}
                    disabled={isRunning}
                >
                    {Object.entries(KHUNG_HINH).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                    ))}
                </select>
            </div>
            <div className="option-group">
                <label htmlFor="style-select">Phong cách:</label>
                <select 
                    id="style-select"
                    className="option-select"
                    value={selectedStyle}
                    onChange={e => setSelectedStyle(e.target.value)}
                    disabled={isRunning}
                >
                    {Object.entries(PHONG_CACH).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                    ))}
                </select>
            </div>
        </div>
        <div className="controls">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={isRunning}>
            ✨ Bắt đầu tạo ảnh
          </button>
          <button className="btn btn-danger" onClick={handleStop} disabled={!isRunning}>
            ⏹️ Dừng lại
          </button>
        </div>
        <div className="status-section">
          <div className="progress-bar">
            <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="status-label" aria-live="polite">{status}</p>
        </div>
      </div>

      <div className="panel output-panel">
        <h2 className="panel-header">🎨 Thư viện ảnh</h2>
        <div className="gallery">
          {results.length === 0 && !isRunning && <p className="panel-description">Hình ảnh được tạo sẽ xuất hiện ở đây...</p>}
          {results.map((result, index) => (
            <div key={index} className="image-card">
              <img src={result.imageUrl} alt={`Ảnh cho STT ${result.stt} (${result.variant})`} loading="lazy" />
              <div className="image-overlay">
                <span className="image-stt">STT: {result.stt} ({result.variant})</span>
                <button className="download-btn" title="Tải ảnh" onClick={() => handleDownload(result.stt, result.variant, result.imageUrl)}>
                  📥
                </button>
              </div>
            </div>
          ))}
          {isRunning && <div className="image-card"><div className="placeholder"><div className="spinner"></div></div></div>}
        </div>
        <h3 className="panel-header" style={{ marginTop: '20px', fontSize: '1.2em' }}>📝 Log hoạt động</h3>
        <div className="log-viewer" ref={logContainerRef}>
            {logs.map((log, index) => (
                <p key={index}><b>[{log.timestamp}]</b> {log.message}</p>
            ))}
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
