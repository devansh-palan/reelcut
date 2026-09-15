import { useCallback, useState } from 'react'
import type { MediaAsset } from '../types'
import { ingestFile, isSupportedFile } from './media'
import { engine } from '../engine/engine'
import { useToast } from '../store/toast'

/**
 * Shared file → asset pipeline: probes metadata, builds thumbnails and
 * registers the decoded element with the engine. Files are processed one at
 * a time to keep memory use predictable on phones.
 */
export function useImport() {
  const [pending, setPending] = useState(0)
  const show = useToast((s) => s.show)

  const importFiles = useCallback(
    async (files: FileList | File[], onAsset: (asset: MediaAsset) => void) => {
      const list = Array.from(files)
      const usable = list.filter(isSupportedFile)
      if (usable.length < list.length) show('Some files were skipped (only video and images are supported)', 'error')
      setPending((n) => n + usable.length)
      for (const file of usable) {
        try {
          const asset = await ingestFile(file)
          engine.register(asset)
          onAsset(asset)
        } catch {
          show(`Couldn't read ${file.name}`, 'error')
        } finally {
          setPending((n) => Math.max(0, n - 1))
        }
      }
    },
    [show],
  )

  return { importFiles, pending }
}
