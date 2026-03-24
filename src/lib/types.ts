export interface Profile {
  id: string
  full_name: string
  role: 'admin' | 'employee'
  created_at: string
}

export interface Category {
  id: number
  name: string
  icon: string
}

export interface Receipt {
  id: string
  user_id: string
  vendor: string
  date: string
  amount: number
  tax: number
  category_id: number | null
  payment_method: string
  image_url: string | null
  status: 'pending' | 'synced' | 'flagged'
  notes: string
  created_at: string
  profiles?: Profile
  categories?: Category
}
