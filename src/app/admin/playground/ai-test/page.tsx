"use client";

import PromptVariationComparison from "@/app/admin/playground/ai-test/_components/display";
import StreamingPromptVariation from "@/app/admin/playground/ai-test/_components/streaming";
import { agentResponseSchema } from "@/app/api/ai/agent/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { Loader2, RefreshCw, Save, StopCircle } from "lucide-react";
import { useState } from "react";

export default function AITestPage() {
  const [basePrompt, setBasePrompt] = useState(
    "This is a base voice AI prompt for a healthcare call script. The agent will discuss {{topic}} with {{patientName}} regarding their {{appointmentType}} appointment on {{appointmentDate}}.",
  );
  const [voicemailMessage, setVoicemailMessage] = useState(
    "Hi {{patientName}}, this is {{clinicName}} calling about your upcoming appointment.",
  );
  const [naturalLanguageInput, setNaturalLanguageInput] = useState(
    "Make the prompt more empathetic and add language about needing to verify their insurance information before the appointment.",
  );

  // Store saved variations for comparison
  const [savedVariations, setSavedVariations] = useState([]);
  const [activeTab, setActiveTab] = useState("create");

  // Use the AI SDK's useObject hook
  const {
    object: streamedData,
    submit,
    isLoading: isGenerating,
    error,
    stop,
  } = useObject({
    api: "/api/ai/agent",
    schema: agentResponseSchema,
  });

  const generatePrompt = () => {
    // Submit the data to the API
    submit({
      basePrompt,
      baseVoicemailMessage: voicemailMessage,
      naturalLanguageInput,
      campaignContext: {
        name: "Test Campaign",
        description: "A test campaign to verify streaming",
      },
    });
  };

  // Save the current variation for comparison
  const saveVariation = () => {
    if (streamedData) {
      setSavedVariations([...savedVariations, streamedData]);
    }
  };

  // Clear all saved variations
  const clearSavedVariations = () => {
    setSavedVariations([]);
  };

  return (
    <div className="container mx-auto max-w-6xl py-10">
      <h1 className="mb-6 text-2xl font-bold">AI Agent Testing & Comparison</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Variation</TabsTrigger>
          <TabsTrigger value="compare" disabled={savedVariations.length < 1}>
            Compare Variations ({savedVariations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-4 space-y-4">
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label htmlFor="basePrompt">Base Prompt</Label>
                <Textarea
                  id="basePrompt"
                  value={basePrompt}
                  onChange={(e) => setBasePrompt(e.target.value)}
                  rows={4}
                  className="w-full"
                />
              </div>

              <div>
                <Label htmlFor="voicemailMessage">Voicemail Message</Label>
                <Textarea
                  id="voicemailMessage"
                  value={voicemailMessage}
                  onChange={(e) => setVoicemailMessage(e.target.value)}
                  rows={3}
                  className="w-full"
                />
              </div>

              <div>
                <Label htmlFor="naturalLanguageInput">
                  Natural Language Input
                </Label>
                <Textarea
                  id="naturalLanguageInput"
                  value={naturalLanguageInput}
                  onChange={(e) => setNaturalLanguageInput(e.target.value)}
                  rows={3}
                  className="w-full"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={generatePrompt}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : streamedData ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </>
                  ) : (
                    "Generate Variation"
                  )}
                </Button>

                {isGenerating && (
                  <Button onClick={stop} variant="outline" className="w-auto">
                    <StopCircle className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                )}

                {streamedData && !isGenerating && (
                  <Button
                    onClick={saveVariation}
                    variant="secondary"
                    className="w-auto"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save for Comparison
                  </Button>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-500">
                  Error: {error.message || "Something went wrong"}
                </div>
              )}

              {savedVariations.length > 0 && (
                <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-500">
                  <span>
                    {savedVariations.length} variation(s) saved for comparison
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSavedVariations}
                    className="h-auto py-1 text-blue-600 hover:text-blue-800"
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>

            <div className="max-h-[calc(100vh-200px)] space-y-4 overflow-y-auto">
              {/* Use our streaming component here */}
              <StreamingPromptVariation
                streamedData={streamedData}
                isGenerating={isGenerating}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compare" className="mt-4 space-y-4">
          {savedVariations.length >= 1 ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">
                  Comparing {savedVariations.length} Variations
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSavedVariations}
                >
                  Clear All
                </Button>
              </div>

              <PromptVariationComparison variations={savedVariations} />
            </>
          ) : (
            <Card className="py-10">
              <div className="text-gray-500 text-center">
                <p>Save at least one variation to enable comparison</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab("create")}
                >
                  Create A Variation
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
