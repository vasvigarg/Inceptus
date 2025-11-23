import React from "react";
import { Code2, Eye } from "lucide-react";

interface TabViewProps {
  activeTab: "code" | "preview";
  onTabChange: (tab: "code" | "preview") => void;
}

export function TabView({ activeTab, onTabChange }: TabViewProps) {
  return (
    <div className="flex space-x-2 p-4 border-b border-gray-700 bg-black">
      <button
        onClick={() => onTabChange("code")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          activeTab === "code"
            ? "bg-gray-600 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-800"
        }`}
      >
        <Code2 className="w-4 h-4" />
        Code
      </button>
      <button
        onClick={() => onTabChange("preview")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          activeTab === "preview"
            ? "bg-gray-600 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-800"
        }`}
      >
        <Eye className="w-4 h-4" />
        Preview
      </button>
    </div>
  );
}
