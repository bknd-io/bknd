export default function LoginPage() {
   return (
      <form method="POST" action="/api/auth/password/login">
         <input type="email" name="email" placeholder="Email" />
         <input type="password" name="password" placeholder="Password" />
         <button type="submit">Login</button>
      </form>
   );
}
