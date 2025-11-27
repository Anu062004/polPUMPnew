'use client'

// Example component showing how to use the toast system
// This can be integrated into any component that needs notifications

import { useToast, ToastContainer } from '@/components/ui/toast'

export default function ToastExample() {
  const { toasts, removeToast, success, error, info, warning } = useToast()

  return (
    <div>
      {/* Your component content */}
      <div className="space-y-2">
        <button onClick={() => success('Success!', 'Your action completed successfully')} className="btn-primary">
          Show Success
        </button>
        <button onClick={() => error('Error!', 'Something went wrong')} className="btn-primary">
          Show Error
        </button>
        <button onClick={() => info('Info', 'Here is some information')} className="btn-primary">
          Show Info
        </button>
        <button onClick={() => warning('Warning', 'Please be careful')} className="btn-primary">
          Show Warning
        </button>
      </div>

      {/* Toast Container - Add this once at the root level */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

// Usage in other components:
// 
// import { useToast } from '@/components/ui/toast'
// 
// function MyComponent() {
//   const { success, error } = useToast()
//   
//   const handleAction = async () => {
//     try {
//       // ... your action
//       success('Token created!', 'Your token is now live')
//     } catch (err) {
//       error('Failed', err.message)
//     }
//   }
// }
