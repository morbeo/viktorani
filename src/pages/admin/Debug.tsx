import AdminLayout from '@/components/AdminLayout'
import DebugInfo from '@/components/DebugInfo'

/** Build and runtime info for bug reports, opened from the version entry in the sidebar. */
export default function Debug() {
  return (
    <AdminLayout title="Debug info">
      <div className="max-w-2xl mx-auto py-6 px-4">
        <DebugInfo />
      </div>
    </AdminLayout>
  )
}
