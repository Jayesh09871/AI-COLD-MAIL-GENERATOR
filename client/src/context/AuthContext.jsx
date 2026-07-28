import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                const parsed = JSON.parse(userInfo);
                // SECURITY FIX: sanitize stale / partial userInfo objects.
                // Old Signup code (pre-fix) used to persist { token: undefined,
                // isVerified: undefined } which evaded truthy checks but also
                // bypassed isVerified===false redirects. Normalize these into a
                // well-formed object:
                //   • missing / undefined isVerified → treat as unverified (false)
                //   • missing / undefined _id → object is garbage → discard
                //   • missing token → only allowed for unverified pending users
                //     (ProtectedRoute still catches isVerified===false → verify)
                if (!parsed || !parsed._id) {
                    localStorage.removeItem('userInfo');
                    localStorage.removeItem('token');
                } else {
                    const normalized = {
                        ...parsed,
                        isVerified: parsed.isVerified === true ? true : false,
                    };
                    // If token is missing, also clear the stale token key so the
                    // axios interceptor / api util doesn't attach garbage.
                    if (!normalized.token) localStorage.removeItem('token');
                    setUser(normalized);
                }
            } catch (e) {
                localStorage.removeItem('userInfo');
                localStorage.removeItem('token');
            }
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        // SECURITY FIX: normalize before persisting. isVerified must always be
        // a strict boolean (never undefined from Signup/register flow).
        const normalizedData = {
            ...(userData || {}),
            isVerified: userData?.isVerified === true ? true : false,
        };
        localStorage.setItem('userInfo', JSON.stringify(normalizedData));
        if (normalizedData.token) localStorage.setItem('token', normalizedData.token);
        else localStorage.removeItem('token');
        setUser(normalizedData);
    };

    const logout = () => {
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
