import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { migratePerTaskLogs } from '@/lib/migrations/migrateTasklogs'
import toast from '@/lib/notify'

export function MigrationPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<{
    created: number
    updated: number
    deleted: number
  } | null>(null)

  const runMigration = async () => {
    setIsRunning(true)
    try {
      const migrationResult = await migratePerTaskLogs()
      setResult(migrationResult)
      toast.success('Migration completed successfully!')
    } catch (error: any) {
      console.error('Migration failed:', error)
      toast.error(`Migration failed: ${error.message}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Per-Task Routine Logs Migration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This migration moves legacy per-task routine logs from the routine_logs table 
            (with string-encoded IDs like "tasklog_*") into the proper routine_task_logs table 
            with explicit columns for routine_id, task_index, date, and checked status.
          </p>

          <div className="space-y-2">
            <p className="font-medium">What this migration does:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Finds all routine_logs entries with ID starting with "tasklog_"</li>
              <li>• Parses the routine ID, task index, and date from the ID</li>
              <li>• Creates corresponding entries in routine_task_logs table</li>
              <li>• Removes the legacy entries from routine_logs</li>
            </ul>
          </div>

          {result && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">Migration Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Badge variant="secondary">{result.created}</Badge>
                  <p className="text-green-700">Created</p>
                </div>
                <div>
                  <Badge variant="secondary">{result.updated}</Badge>
                  <p className="text-green-700">Updated</p>
                </div>
                <div>
                  <Badge variant="secondary">{result.deleted}</Badge>
                  <p className="text-green-700">Deleted</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={runMigration} 
              disabled={isRunning}
              size="lg"
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Running Migration...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Run Migration
                </>
              )}
            </Button>
          </div>

          {!result && (
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> This migration is irreversible. 
                Run this only once and verify the results before proceeding.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}