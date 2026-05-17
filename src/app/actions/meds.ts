"use server"

import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const AddMedicationSchema = z.object({
  name: z.string().min(1).max(100),
  quantity: z.number().int().positive().max(100),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format")
})

const TakeMedicationSchema = z.object({
  scheduleId: z.string().uuid()
})

export async function saveScannedMedications(meds: Array<{name: string, quantity: number, time: string}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  // Strict Validation
  const validatedMeds = z.array(AddMedicationSchema).parse(meds)

  for (const med of validatedMeds) {
    // 1. Insert/Update Medication Stock
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .insert({ name: med.name, user_id: user.id, stock: med.quantity * 10 })
      .select('id')
      .single()

    if (medError || !medication) throw new Error("Failed to save medication")

    // 2. Insert Schedule
    const { error: scheduleError } = await supabase
      .from('schedules')
      .insert({
        medication_id: medication.id,
        user_id: user.id,
        quantity: med.quantity,
        time: med.time
      })

    if (scheduleError) throw new Error("Failed to save schedule")
  }

  revalidatePath('/')
  return { success: true }
}

export async function takeMedication(scheduleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error("Unauthorized")

  const validatedId = TakeMedicationSchema.parse({ scheduleId }).scheduleId

  // Reduce stock by 1 for the associated medication
  const { data: schedule } = await supabase
    .from('schedules')
    .select('medication_id')
    .eq('id', validatedId)
    .single()

  if (!schedule) throw new Error("Schedule not found")

  // Due to RLS, this will only update if the user owns the medication
  const { error } = await supabase
    .rpc('decrement_stock', { row_id: schedule.medication_id })

  if (error) throw new Error("Failed to update stock")

  revalidatePath('/')
  return { success: true }
}
