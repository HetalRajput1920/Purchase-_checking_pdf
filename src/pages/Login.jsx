import React, { useState } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { User, Lock, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

const Login = ({ setToken }) => {
  const [jeid, setJeid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!jeid || !password) {
      setError('Please enter both JEID and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        'http://192.168.1.110:3000/api/auth/multi-role-login',
        {
          username: jeid.trim(),
          password: password.trim(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 10000,
        }
      );

      const data = response.data;
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userName', data.user);
        
        if (data.role) {
          if (Array.isArray(data.role)) {
            localStorage.setItem('role', JSON.stringify(data.role));
            localStorage.setItem('primaryRole', data.role[0]);
          } else {
            localStorage.setItem('role', data.role);
          }
        }

        localStorage.setItem('userData', JSON.stringify({
          name: data.user,
          roles: data.role,
          username: jeid.trim()
        }));

        setToken(data.token);
      } else {
        setError('Login failed: No token received');
      }

    } catch (err) {
      if (err.response) {
        setError(err.response.data.message || 'Invalid JEID or password');
      } else if (err.request) {
        setError('Network error: Unable to connect to server');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faff] p-4 font-['Inter',_sans-serif] relative overflow-hidden">
      {/* Background abstract elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#5F21B5]/10 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[#D9B8FF]/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_50px_rgba(95,33,181,0.1)] p-8 relative z-10 border border-[#f0f0f0]">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-[#5F21B5] rounded-2xl flex items-center justify-center shadow-lg mb-6 rotate-3">
            <LogIn className="w-10 h-10 text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2 tracking-tight">Welcome Back</h1>
          <p className="text-[#666] text-center">Enter your credentials to access the Purchase OCR system</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#4a4a4a] ml-1" htmlFor="jeid">JEID</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#999] group-focus-within:text-[#5F21B5] transition-colors">
                <User size={20} />
              </div>
              <input
                id="jeid"
                type="text"
                placeholder="Enter your JEID"
                className="w-full pl-11 pr-4 py-3.5 bg-[#fcfcfe] border-2 border-[#eee] rounded-2xl focus:border-[#5F21B5] focus:outline-none transition-all text-[#333] placeholder:text-[#aaa]"
                value={jeid}
                onChange={(e) => setJeid(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#4a4a4a] ml-1" htmlFor="password">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#999] group-focus-within:text-[#5F21B5] transition-colors">
                <Lock size={20} />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full pl-11 pr-12 py-3.5 bg-[#fcfcfe] border-2 border-[#eee] rounded-2xl focus:border-[#5F21B5] focus:outline-none transition-all text-[#333] placeholder:text-[#aaa]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#999] hover:text-[#5F21B5] transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center animate-shake">
              <div className="w-1.5 h-6 bg-red-600 rounded-full mr-3"></div>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5F21B5] hover:bg-[#4a1a8f] text-white py-4 rounded-2xl font-bold text-lg shadow-[0_10px_20px_rgba(95,33,181,0.2)] hover:shadow-[0_15px_30px_rgba(95,33,181,0.3)] transform transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <Loader2 className="animate-spin w-6 h-6" />
            ) : (
              <>
                <span>Sign In</span>
                <LogIn className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-[#999] text-sm">
          Technical Issue? <span className="text-[#5F21B5] font-semibold cursor-pointer border-b border-transparent hover:border-[#5F21B5]">Contact Support</span>
        </p>
      </div>
    </div>
  );
};

Login.propTypes = {
  setToken: PropTypes.func.isRequired,
};

export default Login;
