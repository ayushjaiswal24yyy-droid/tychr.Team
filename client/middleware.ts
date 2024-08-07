import {
    protectedRoutes,
    publicRoutes,
    authRoutes
} from "@/routes";

export default function middleware(request: { cookies?: any; nextUrl?: any; }) {
    const { nextUrl } = request;

    const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
    const isAuthRoute = authRoutes.includes(nextUrl.pathname);
    const isProtectedRoute = protectedRoutes.includes(nextUrl.pathname);

    const token = request.cookies.get("jwt")?.value;

    if (isPublicRoute) {
        if (token) return Response.redirect(new URL("/dashboard", nextUrl));
        return Response.redirect(new URL("/auth/sign-in", nextUrl));
    }

    if (isProtectedRoute) {
        if (!token) {
            return Response.redirect(new URL("/auth/sign-in", nextUrl));
        }
        return;
    }

    if (isAuthRoute) {
        if (token) {
            return Response.redirect(new URL("/dashboard", nextUrl));
        }
    }
    return;
}
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}