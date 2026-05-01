'use server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Verifica se o chamador é admin
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role?.includes('admin')) throw new Error('Sem permissão')
  return user
}

export async function createEmployee(formData: FormData) {
  try {
    await verifyAdmin()

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const roleString = formData.get('role') as string
    
    if (!name || !email || !password || !roleString) {
      return { error: 'Todos os campos são obrigatórios.' }
    }

    let role: string[] = []
    try {
      role = JSON.parse(roleString)
    } catch {
      role = [roleString]
    }

    const admin = getSupabaseAdmin()
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return { error: message }
  }
}

export async function deleteEmployee(userId: string) {
  try {
    await verifyAdmin()

    const admin = getSupabaseAdmin()

    // Delete from auth (CASCADE deletes the profile)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return { error: error.message }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return { error: message }
  }
}

export async function updateEmployee(userId: string, formData: FormData) {
  try {
    await verifyAdmin()

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const roleString = formData.get('role') as string
    
    if (!name || !email || !roleString) {
      return { error: 'Nome, email e funções são obrigatórios.' }
    }

    let role: string[] = []
    try {
      role = JSON.parse(roleString)
    } catch {
      role = [roleString]
    }

    const admin = getSupabaseAdmin()
    
    // Configura os campos que serão atualizados
    const updateData: any = {
      email,
      user_metadata: { name, role },
    }
    
    // Atualiza a senha apenas se ela for fornecida e tiver no mínimo 6 caracteres
    if (password && password.length >= 6) {
      updateData.password = password;
    }

    const { error: authError } = await admin.auth.admin.updateUserById(userId, updateData)

    if (authError) return { error: authError.message }
    
    // Atualiza explicitamente a tabela profiles para garantir a sincronização imediata
    // @ts-expect-error O client admin não possui tipagem forte para a tabela profiles
    const { error: profileError } = await admin.from('profiles').update({ name, role }).eq('id', userId)
    
    if (profileError) {
      console.warn('Erro ao atualizar profiles:', profileError)
      // Não falha a operação principal se a trigger já tiver feito o trabalho
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return { error: message }
  }
}
