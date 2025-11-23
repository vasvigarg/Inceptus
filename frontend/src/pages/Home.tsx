import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export function Home() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      navigate("/builder", { state: { prompt } });
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-semibold text-white mb-4 tracking-normal">
            Inceptus
          </h1>

          <p className="text-xl text-gray-400 font-normal leading-relaxed">
            Derived from the Latin word for “the beginning,” Inceptus is for
            founders who lead, not lag. Your simple description is the catalyst
            for our AI to deliver a full, launch-ready website in moments.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the website you want to build..."
              className="w-full p-4 pr-16 bg-black text-white border border-gray-700 rounded-lg focus:outline-none placeholder-gray-500"
            />

            <button
              type="submit"
              disabled={!prompt.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-gray-600 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                ></path>
              </svg>
            </button>
          </div>

          <p className="text-center text-gray-500 text-sm mt-3">
            Press Enter or click the arrow to generate
          </p>
        </form>
      </div>
    </div>
  );
}
