import React, { useCallback } from 'react';
import { CanvasValidation } from './CanvasValidation';

export interface RunPipelineProps {
  nodes: any[];
  connections: any[];
  onRunClick: () => void;
  isRunning: boolean;
  gpuWorkerStatus: Record<string, { healthy: boolean; capabilities: string[] }>;
}

export const RunPipelineButton: React.FC<RunPipelineProps> = ({
  nodes,
  connections,
  onRunClick,
  isRunning,
  gpuWorkerStatus,
}) => {
  const [isValid, setIsValid] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [showErrors, setShowErrors] = React.useState(false);

  const handleValidationChange = useCallback(
    (valid: boolean, validationErrors: string[]) => {
      setIsValid(valid);
      setErrors(validationErrors);
    },
    []
  );

  const hasHealthyGPUWorker = Object.values(gpuWorkerStatus || {}).some(
    (w) => w.healthy
  );

  return (
    <div className="run-pipeline-container">
      <CanvasValidation
        nodes={nodes}
        connections={connections}
        onValidationChange={handleValidationChange}
      />

      <div className="pipeline-controls">
        <button
          className={`run-button ${isValid ? 'enabled' : 'disabled'} ${isRunning ? 'running' : ''}`}
          onClick={onRunClick}
          disabled={!isValid || isRunning}
        >
          {isRunning ? (
            <>
              <span className="spinner">⟳</span>
              Processing...
            </>
          ) : (
            <>
              <span className="icon">▶</span>
              Run Pipeline
            </>
          )}
        </button>

        <div className="worker-status">
          <span className="label">GPU Workers:</span>
          <span
            className={`status ${hasHealthyGPUWorker ? 'healthy' : 'offline'}`}
          >
            {hasHealthyGPUWorker ? '● Online' : '● Offline'}
          </span>
          <span className="count">
            ({Object.keys(gpuWorkerStatus || {}).length} configured)
          </span>
        </div>
      </div>

      {!isValid && (
        <div className="error-banner">
          <button
            className="toggle-errors"
            onClick={() => setShowErrors(!showErrors)}
          >
            {showErrors ? '▼' : '▶'} Show {errors.length} error(s)
          </button>
          {showErrors && (
            <ul className="error-list">
              {errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style jsx>{`
        .run-pipeline-container {
          padding: 16px;
          background: #0f0f0f;
          border-radius: 8px;
          border: 1px solid #222;
        }

        .pipeline-controls {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .run-button {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .run-button.enabled {
          background: linear-gradient(135deg, #a855f7, #ec4899);
          color: white;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
        }

        .run-button.enabled:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 30px rgba(168, 85, 247, 0.6);
        }

        .run-button.disabled {
          background: #333;
          color: #666;
          cursor: not-allowed;
          opacity: 0.5;
        }

        .run-button.running {
          pointer-events: none;
        }

        .spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .icon {
          font-size: 12px;
        }

        .worker-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          font-size: 12px;
        }

        .worker-status .label {
          color: #aaa;
        }

        .worker-status .status {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .worker-status .status.healthy {
          color: #34d399;
        }

        .worker-status .status.offline {
          color: #ef4444;
        }

        .worker-status .count {
          color: #666;
        }

        .error-banner {
          margin-top: 12px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 6px;
        }

        .toggle-errors {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          padding: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          text-align: left;
        }

        .toggle-errors:hover {
          color: #f87171;
        }

        .error-list {
          list-style: none;
          padding: 8px 0 0 0;
          margin: 0;
          border-top: 1px solid rgba(239, 68, 68, 0.2);
        }

        .error-list li {
          padding: 6px 0;
          color: #fca5a5;
          font-size: 11px;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
};

export default RunPipelineButton;
