import { useCallback, useState } from 'react';
import { getInfoAsync, uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { useRequestUploadUrl } from '@workspace/api-client-react';

export type UploadState = 'idle' | 'uploading' | 'done' | 'error';

interface UploadResult {
  objectPath: string;
}

/**
 * Handles the two-step presigned-URL upload flow:
 *  1. Request a presigned upload URL from the API.
 *  2. PUT the file bytes directly to that URL.
 *
 * Returns the `objectPath` which can be passed directly to generation APIs.
 */
export function useFileUpload() {
  const requestUrl = useRequestUploadUrl();
  const [state, setState] = useState<UploadState>('idle');

  const upload = useCallback(
    async (
      uri: string,
      fileName: string,
      contentType: string,
    ): Promise<UploadResult> => {
      setState('uploading');
      try {
        // Get file size from the device
        const info = await getInfoAsync(uri);
        if (!info.exists) throw new Error('File not found on device.');
        const size = info.size;

        // Step 1: request a presigned upload URL
        const { uploadURL, objectPath } = await requestUrl.mutateAsync({
          data: { name: fileName, size, contentType },
        });

        // Step 2: upload the file directly to the presigned URL
        const result = await uploadAsync(uploadURL, uri, {
          httpMethod: 'PUT',
          uploadType: FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Type': contentType },
        });

        if (result.status < 200 || result.status >= 300) {
          throw new Error(`Upload failed with status ${result.status}`);
        }

        setState('done');
        return { objectPath };
      } catch (err) {
        setState('error');
        throw err;
      }
    },
    [requestUrl],
  );

  const reset = useCallback(() => {
    setState('idle');
  }, []);

  return { upload, state, reset, isUploading: state === 'uploading' };
}
