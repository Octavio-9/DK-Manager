import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Mail, ListTodo } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, ROLE_COLORS } from '../lib/constants'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'

async function fetchTeam() {
  const { data, error } = await supabase.from('User').select('*, roleRel:Role(id, name), taskCount:Task(count)').order('name')
  if (error) throw error
  return (data || []).map((u) => ({ ...u, taskCount: u.taskCount?.[0]?.count || 0 }))
}

export default function Team() {
  const { onlineIds } = useAuth()
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: fetchTeam,
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <p className="text-text-secondary">Chargement…</p>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {members.map((member) => {
        const isOnline = onlineIds.includes(member.id)
        return (
        <div key={member.id} className="flex flex-col items-center rounded-xl border border-c-border bg-bg-card p-4 text-center sm:p-6">
          <div className="relative">
            <Avatar name={member.name} bg={member.avatarBg} src={member.avatarUrl} size="lg" />
            {isOnline && (
              <span
                className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-bg-card bg-c-success"
                title="En ligne"
              />
            )}
          </div>
          <p className="mt-3 font-semibold text-text-primary">{member.name}</p>
          <div className="mt-2 flex flex-col items-center gap-1">
            <Badge color={ROLE_COLORS[member.roleRel?.name || member.role]}>{ROLE_LABELS[member.roleRel?.name || member.role] || member.roleRel?.name || member.role}</Badge>
            {isOnline && (
              <span className="flex items-center gap-1 text-xs font-medium text-c-success">
                <span className="h-1.5 w-1.5 rounded-full bg-c-success" />
                En ligne
              </span>
            )}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-text-secondary">
            <Mail size={14} className="text-text-muted" />
            {member.email}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
            <ListTodo size={14} />
            {member.taskCount} tâche{member.taskCount > 1 ? 's' : ''} assignée{member.taskCount > 1 ? 's' : ''}
          </p>
        </div>
        )
      })}
    </div>
  )
}
