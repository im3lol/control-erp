import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  // Required for proxy environments (Caddy reverse proxy)
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'اسم المستخدم', type: 'text' },
        password: { label: 'كلمة المرور', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('يرجى إدخال اسم المستخدم وكلمة المرور')
        }

        const user = await db.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user) {
          throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة')
        }

        if (!user.isActive) {
          throw new Error('هذا الحساب معطل. تواصل مع المسؤول')
        }

        // Verify password (base64 encoded)
        const encodedPassword = Buffer.from(credentials.password).toString('base64')
        if (user.password !== encodedPassword) {
          throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة')
        }

        // Get the user's first company for the token
        const companyUser = await db.companyUser.findFirst({
          where: { userId: user.id, isActive: true },
          select: { companyId: true, role: true },
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          companyId: companyUser?.companyId || null,
          companyRole: companyUser?.role || null,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.username = (user as any).username
        token.companyId = (user as any).companyId
        token.companyRole = (user as any).companyRole
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).username = token.username
        ;(session.user as any).companyId = token.companyId
        ;(session.user as any).companyRole = token.companyRole
      }
      return session
    },
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    pkceCodeVerifier: {
      name: `next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'erp-secret-key-2024',
}

export default NextAuth(authOptions)
