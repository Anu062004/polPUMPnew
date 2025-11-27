'use client'

import { CheckCircle, Shield, AlertCircle } from 'lucide-react'
import { InfoTooltip } from './InfoTooltip'

interface VerifiedBadgeProps {
  type: 'verified' | 'audited' | 'pending' | 'unverified'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const badgeConfig = {
  verified: {
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
    label: 'Verified',
    tooltip: 'This token has been verified by the platform'
  },
  audited: {
    icon: Shield,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
    label: 'Audited',
    tooltip: 'Smart contract has been audited for security'
  },
  pending: {
    icon: AlertCircle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/50',
    label: 'Pending',
    tooltip: 'Verification is pending'
  },
  unverified: {
    icon: AlertCircle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/50',
    label: 'Unverified',
    tooltip: 'This token has not been verified. Trade with caution.'
  }
}

const sizeConfig = {
  sm: {
    icon: 'w-3 h-3',
    padding: 'px-2 py-1',
    text: 'text-xs'
  },
  md: {
    icon: 'w-4 h-4',
    padding: 'px-3 py-1.5',
    text: 'text-sm'
  },
  lg: {
    icon: 'w-5 h-5',
    padding: 'px-4 py-2',
    text: 'text-base'
  }
}

export default function VerifiedBadge({ type, size = 'md', showLabel = true }: VerifiedBadgeProps) {
  const config = badgeConfig[type]
  const sizes = sizeConfig[size]
  const Icon = config.icon

  return (
    <div className="inline-flex items-center gap-1">
      <div
        className={`inline-flex items-center gap-1.5 ${sizes.padding} ${config.bgColor} ${config.color} border ${config.borderColor} rounded-full ${sizes.text} font-medium`}
      >
        <Icon className={sizes.icon} />
        {showLabel && <span>{config.label}</span>}
      </div>
      <InfoTooltip content={config.tooltip} side="top" />
    </div>
  )
}

// Usage examples:
// <VerifiedBadge type="verified" />
// <VerifiedBadge type="audited" size="sm" />
// <VerifiedBadge type="pending" showLabel={false} />
