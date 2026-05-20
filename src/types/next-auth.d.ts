import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      username: string
      role: string
      companyId: string | null
      companyRole: string | null
    }
  }

  interface User {
    id: string
    name: string
    email: string
    username: string
    role: string
    companyId: string | null
    companyRole: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    username: string
    companyId: string | null
    companyRole: string | null
  }
}
