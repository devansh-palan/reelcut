import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useProject } from '../../store/project'

interface Props {
  icon: ReactNode
  title: string
  right?: ReactNode
}

export default function PanelHead({ icon, title, right }: Props) {
  const setTool = useProject((s) => s.setTool)
  return (
    <div className="head">
      <span className="title">
        {icon}
        {title}
      </span>
      <span className="row">
        {right}
        <button className="icon-btn" style={{ width: 32, height: 32, color: 'var(--mint)' }} onClick={() => setTool('none')} aria-label="Done">
          <Check size={20} />
        </button>
      </span>
    </div>
  )
}
