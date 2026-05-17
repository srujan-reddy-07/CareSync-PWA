"use server"

import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters")
})

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Strict Validation
  const validated = AuthSchema.parse({ email, password })

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: validated.email,
    password: validated.password,
  })

  if (error) {
    throw new Error('Invalid login credentials') // Generic message to prevent enumeration
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string

  const validated = AuthSchema.parse({ email, password })

  const supabase = await createClient()

  const { error, data } = await supabase.auth.signUp({
    email: validated.email,
    password: validated.password,
  })

  if (error) throw new Error('Signup failed')

  if (data.user) {
      // Create initial profile strictly bound to this user
      await supabase.from('profiles').insert({
          id: data.user.id,
          role: role === 'caretaker' ? 'caretaker' : 'user'
      })
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
