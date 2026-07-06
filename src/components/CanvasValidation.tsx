import React, { useState, useCallback } from 'react';
import { validatePipelineConnectivity } from '../nodes/schemas/nodeValidation';

export interface CanvasValidationProps {
  nodes: any[];
  connections: any[];
  onValidationChange: (isValid: boolean, errors: string[]) => void;
}

export const CanvasValidation: React.FC<CanvasValidationProps> = ({
  nodes,
  connections,
  onValidationChange,
}) => {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(false);

  const validateCanvas = useCallback(() => {
    const errors: string[] = [];

    // 1. Check for empty required prompts (min 3 characters)
    nodes.forEach((node) => {
      if (node.type === 'cyclorama-studio' || node.type === 'stage-rendering') {
        const prompt = node.data?.environmentPrompt || node.data?.stylePrompt || '';
        if (prompt && prompt.length < 3) {
          errors.push(
            `Node "${node.id}" (${node.type}): Prompt must be at least 3 characters, got ${prompt.length}`
          );
        }
      }
    });

    // 2. Check connectivity
    const connectivityErrors = validatePipelineConnectivity(nodes, connections);
    errors.push(...connectivityErrors);

    // 3. Check for required connections
    const characterNodes = nodes.filter((n) => n.type === 'character-input');
    const audioNodes = nodes.filter((n) => n.type === 'audio-track');
    const lipSyncNodes = nodes.filter((n) => n.type === 'lipsync-video-gen');
    const studioNodes = nodes.filter((n) => n.type === 'cyclorama-studio');
    const renderNodes = nodes.filter((n) => n.type === 'stage-rendering');

    if (lipSyncNodes.length > 0 && characterNodes.length === 0) {
      errors.push('Lip-sync node present but no Character Input node found');
    }

    if (lipSyncNodes.length > 0 && audioNodes.length === 0) {
      errors.push('Lip-sync node present but no Audio Track node found');
    }

    if (renderNodes.length > 0 && studioNodes.length === 0) {
      errors.push('Stage Rendering node present but no Studio node found');
    }

    // 4. Validate individual node data
    nodes.forEach((node) => {
      const nodeErrors: string[] = [];

      if (node.type === 'character-input' && node.data) {
        if (!node.data.characterId) nodeErrors.push('Character ID required');
        if (!node.data.characterName) nodeErrors.push('Character name required');
        if (!node.data.referenceImage) nodeErrors.push('Reference image required');
      }

      if (node.type === 'audio-track' && node.data) {
        if (!node.data.audioUrl) nodeErrors.push('Audio URL required');
        if (!node.data.duration || node.data.duration <= 0)
          nodeErrors.push('Valid duration required');
      }

      if (node.type === 'cyclorama-studio' && node.data) {
        if (!node.data.environmentPrompt || node.data.environmentPrompt.length < 3) {
          nodeErrors.push('Environment prompt must be at least 3 characters');
        }
      }

      if (node.type === 'lipsync-video-gen' && node.data) {
        if (!node.data.characterInputId) nodeErrors.push('Character input reference required');
        if (!node.data.audioTrackId) nodeErrors.push('Audio track reference required');
      }

      if (node.type === 'stage-rendering' && node.data) {
        if (!node.data.cycloramaStudioId) nodeErrors.push('Studio reference required');
        if (!node.data.lipSyncVideoId) nodeErrors.push('Lip-sync video reference required');
      }

      if (nodeErrors.length > 0) {
        errors.push(
          `Node "${node.id}" (${node.type}): ${nodeErrors.join('; ')}`
        );
      }
    });

    setValidationErrors(errors);
    const valid = errors.length === 0;
    setIsValid(valid);
    onValidationChange(valid, errors);
  }, [nodes, connections, onValidationChange]);

  React.useEffect(() => {
    validateCanvas();
  }, [validateCanvas]);

  return (
    <div className="canvas-validation-panel">
      <div className={`validation-status ${isValid ? 'valid' : 'invalid'}`}>
        {isValid ? (
          <div className="status-message success">
            ✓ Pipeline is valid and ready to run
          </div>
        ) : (
          <div className="status-message error">
            ✗ Pipeline has {validationErrors.length} error(s)
          </div>
        )}
      </div>

      {validationErrors.length > 0 && (
        <div className="errors-list">
          <h4>Validation Errors:</h4>
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index} className="error-item">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .canvas-validation-panel {
          padding: 16px;
          background: #1a1a1a;
          border-radius: 8px;
          margin: 8px 0;
          border-left: 4px solid #666;
        }

        .validation-status {
          margin-bottom: 16px;
        }

        .status-message {
          padding: 12px;
          border-radius: 6px;
          font-weight: 500;
          font-size: 14px;
        }

        .status-message.success {
          background: rgba(52, 211, 153, 0.1);
          color: #34d399;
          border: 1px solid rgba(52, 211, 153, 0.3);
        }

        .status-message.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .errors-list {
          display: none;
        }

        .errors-list.show {
          display: block;
        }

        .errors-list h4 {
          margin: 0 0 8px 0;
          color: #ef4444;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .errors-list ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .error-item {
          padding: 8px 10px;
          background: rgba(239, 68, 68, 0.05);
          border-left: 3px solid #ef4444;
          color: #fca5a5;
          font-size: 12px;
          font-family: 'Courier New', monospace;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default CanvasValidation;
