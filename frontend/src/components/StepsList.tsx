import React from "react";
import { Check, Clock, Circle } from "lucide-react";
import { Step } from "../types";

interface StepsListProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (stepId: number) => void;
}

export function StepsList({ steps, currentStep, onStepClick }: StepsListProps) {
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div
          key={step.id}
          className="cursor-pointer transition-colors hover:bg-gray-900 p-2 rounded"
          onClick={() => onStepClick(step.id)}
        >
          <div className="flex items-start gap-3">
            {step.status === "completed" ? (
              <Check
                className="w-5 h-5 text-white flex-shrink-0 mt-0.5"
                strokeWidth={3}
              />
            ) : step.status === "in-progress" ? (
              <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-normal text-white text-sm leading-tight">
                {step.title}
              </h3>
              {step.description && (
                <p className="text-xs text-gray-400 mt-1 leading-tight">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
