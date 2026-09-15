import { useToast } from '../store/toast'

export default function Toast() {
  const message = useToast((s) => s.message)
  const tone = useToast((s) => s.tone)
  if (!message) return null
  return <div className={`toast ${tone}`}>{message}</div>
}
