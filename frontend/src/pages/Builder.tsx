import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { StepsList } from "../components/StepsList";
import { FileExplorer } from "../components/FileExplorer";
import { TabView } from "../components/TabView";
import { CodeEditor } from "../components/CodeEditor";
import { PreviewFrame } from "../components/PreviewFrame";
import { Step, FileItem, StepType } from "../types";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { parseXml } from "../steps";
import { useWebContainer } from "../hooks/useWebContainer";
import { FileNode } from "@webcontainer/api";
import { Loader } from "../components/Loader";

// Define the correct Content type for the Gemini API structure
type GeminiContent = {
  // Role must be "model" for the AI response
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

// Original Message type used in state, updated to match Gemini format
type Message = GeminiContent;

// Helper function to generate a guaranteed unique ID.
const generateUniqueId = () => Date.now() + Math.floor(Math.random() * 1000);

// Type guard for Axios errors (works even if axios.isAxiosError isn't present on the imported object)
const isAxiosError = (err: unknown): boolean => {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as any).isAxiosError === true
  );
};

export function Builder() {
  const location = useLocation();
  const { prompt } = location.state as { prompt: string };
  const [userPrompt, setPrompt] = useState("");
  const [llmMessages, setLlmMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateSet, setTemplateSet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webcontainer = useWebContainer();

  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const [steps, setSteps] = useState<Step[]>([]);

  const [files, setFiles] = useState<FileItem[]>([]);

  useEffect(() => {
    let originalFiles = [...files];
    let updateHappened = false;
    steps
      .filter(({ status }) => status === "pending")
      .map((step) => {
        updateHappened = true;
        if (step?.type === StepType.CreateFile) {
          let parsedPath = step.path?.split("/") ?? []; // ["src", "components", "App.tsx"]
          let currentFileStructure = [...originalFiles]; // {}
          let finalAnswerRef = currentFileStructure;

          let currentFolder = "";
          while (parsedPath.length) {
            currentFolder = `${currentFolder}/${parsedPath[0]}`;
            let currentFolderName = parsedPath[0];
            parsedPath = parsedPath.slice(1);

            if (!parsedPath.length) {
              // final file
              let file = currentFileStructure.find(
                (x) => x.path === currentFolder
              );
              if (!file) {
                currentFileStructure.push({
                  name: currentFolderName,
                  type: "file",
                  path: currentFolder,
                  content: step.code,
                });
              } else {
                file.content = step.code;
              }
            } else {
              /// in a folder
              let folder = currentFileStructure.find(
                (x) => x.path === currentFolder
              );
              if (!folder) {
                // create the folder
                currentFileStructure.push({
                  name: currentFolderName,
                  type: "folder",
                  path: currentFolder,
                  children: [],
                });
              }

              currentFileStructure = currentFileStructure.find(
                (x) => x.path === currentFolder
              )!.children!;
            }
          }
          originalFiles = finalAnswerRef;
        }
      });

    if (updateHappened) {
      setFiles(originalFiles);
      setSteps((steps) =>
        steps.map((s: Step) => {
          return {
            ...s,
            status: "completed",
          };
        })
      );
    }
    console.log("Updated Files Structure:", files);
  }, [steps, files]);

  useEffect(() => {
    const createMountStructure = (files: FileItem[]): Record<string, any> => {
      const mountStructure: Record<string, any> = {};

      const processFile = (file: FileItem, isRootFolder: boolean) => {
        if (file.type === "folder") {
          mountStructure[file.name] = {
            directory: file.children
              ? Object.fromEntries(
                  file.children.map((child: FileItem) => [
                    child.name,
                    processFile(child, false),
                  ])
                )
              : {},
          };
        } else if (file.type === "file") {
          if (isRootFolder) {
            mountStructure[file.name] = {
              file: {
                contents: file.content || "",
              },
            };
          } else {
            return {
              file: {
                contents: file.content || "",
              },
            };
          }
        }

        return mountStructure[file.name];
      };

      files.forEach((file) => processFile(file, true));

      return mountStructure;
    };

    const mountStructure = createMountStructure(files);

    console.log("WebContainer Mount Structure:", mountStructure);
    webcontainer?.mount(mountStructure);
  }, [files, webcontainer]);

  async function init() {
    setError(null);
    try {
      const response = await axios.post<{
        prompts: string[];
        uiPrompts: string[];
      }>(`${BACKEND_URL}/template`, {
        prompt: prompt.trim(),
      });
      setTemplateSet(true);

      const { prompts, uiPrompts } = response.data;

      setSteps(
        parseXml(uiPrompts[0]).map((x: Step) => ({
          ...x,
          status: "pending",
          id: generateUniqueId(),
        }))
      );

      const initialMessages: Message[] = [...prompts, prompt].map(
        (content) => ({
          role: "user",
          parts: [{ text: content }],
        })
      );

      setLoading(true);

      const chatPayload = { messages: initialMessages };
      console.log(
        "Initial Chat Request Payload:",
        JSON.stringify(chatPayload, null, 2)
      );

      const stepsResponse = await axios.post<{ response: string }>(
        `${BACKEND_URL}/chat`,
        chatPayload
      );

      setLoading(false);

      setSteps((s) => [
        ...s,
        ...parseXml(stepsResponse.data.response).map((x: Step) => ({
          ...x,
          status: "pending" as "pending",
          id: generateUniqueId(),
        })),
      ]);
    } catch (e: unknown) {
      const msg =
        isAxiosError(e) && (e as any).response?.data?.error
          ? (e as any).response.data.error
          : "Failed to initialize project (Server Error). Check backend logs.";
      setError(msg);
      setLoading(false);
    }
  }

  useEffect(() => {
    init();
  }, []);

  const handleSendPrompt = async () => {
    setError(null);
    if (!userPrompt.trim()) return;

    try {
      const newMessage: Message = {
        role: "user",
        parts: [{ text: userPrompt }],
      };

      setLoading(true);

      const chatPayload = { messages: [...llmMessages, newMessage] };
      // Log the exact payload being sent to help debug the 500 error
      console.log(
        "Follow-up Chat Request Payload:",
        JSON.stringify(chatPayload, null, 2)
      );

      const stepsResponse = await axios.post<{ response: string }>(
        `${BACKEND_URL}/chat`,
        chatPayload
      );

      setLoading(false);

      // Add both user message and model response atomically
      setLlmMessages((prevMessages) => [
        ...prevMessages,
        newMessage,
        {
          role: "model",
          parts: [{ text: stepsResponse.data.response }],
        },
      ]);

      setSteps((s) => [
        ...s,
        ...parseXml(stepsResponse.data.response).map((x: Step) => ({
          ...x,
          status: "pending" as "pending",
          id: generateUniqueId(),
        })),
      ]);

      setPrompt("");
    } catch (e: unknown) {
      const msg =
        isAxiosError(e) && (e as any).response?.data?.error
          ? (e as any).response.data.error
          : "Failed to process request (Internal Server Error 500). Please check your backend terminal for details.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <header className="bg-black border-b border-gray-700 px-6 py-3 flex-shrink-0">
        <h1 className="text-lg font-semibold text-white tracking-normal">
          Inceptus
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Prompt: {prompt}</p>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-4 gap-0">
          {/* Column 1: Build Steps and Input */}
          <div className="col-span-1 flex flex-col bg-black border-r border-gray-700 overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">Build Steps</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <StepsList
                steps={steps}
                currentStep={currentStep}
                onStepClick={setCurrentStep}
              />
            </div>

            {/* Fixed Input Area at the bottom */}
            <div className="p-4 border-t border-gray-700 flex-shrink-0">
              <div className="flex flex-col">
                {(loading || !templateSet) && (
                  <div className="py-4">
                    <Loader />
                  </div>
                )}
                {!(loading || !templateSet) && (
                  <div className="flex flex-col space-y-2">
                    <textarea
                      value={userPrompt}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                      }}
                      className="p-2 w-full text-sm bg-black text-gray-100 border border-gray-700 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-500 placeholder-gray-500"
                      rows={2}
                      placeholder="Enter your next instruction..."
                    ></textarea>
                    <button
                      onClick={handleSendPrompt}
                      disabled={loading}
                      className={`py-2 px-4 rounded-lg text-sm font-semibold transition duration-150 ${
                        loading
                          ? "bg-gray-800 cursor-not-allowed text-gray-500"
                          : "bg-gray-600 hover:bg-gray-700 text-white"
                      }`}
                    >
                      Send Instruction
                    </button>
                    {error && (
                      <p className="text-red-400 text-xs p-2 bg-red-900/50 rounded-md">
                        Error: {error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: File Explorer */}
          <div className="col-span-1 bg-black border-r border-gray-700 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">
                File Explorer
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <FileExplorer files={files} onFileSelect={setSelectedFile} />
            </div>
          </div>

          {/* Column 3 & 4: Code Editor / Preview */}
          <div className="col-span-2 bg-black flex flex-col overflow-hidden">
            <TabView activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="flex-1 overflow-hidden">
              {activeTab === "code" ? (
                <CodeEditor file={selectedFile} />
              ) : (
                <div className="bg-black h-full">
                  <PreviewFrame webContainer={webcontainer} files={files} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
