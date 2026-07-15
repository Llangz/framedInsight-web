"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI Disease Detection
// Location: /app/dashboard/smallRuminants/health/diagnose/page.tsx
//
// Photo-based disease diagnosis using Claude API:
//   - Upload photo of sick animal
//   - AI analyzes symptoms
//   - Provides probable diagnoses
//   - Suggests treatments
//   - Recommends vet consultation when needed
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DiagnosisResult {
  probable_diseases: Array<{
    name: string;
    confidence: "high" | "medium" | "low";
    symptoms: string[];
    treatment: string;
    urgency: "immediate" | "soon" | "monitor";
  }>;
  vet_recommended: boolean;
  general_advice: string;
}

export default function AIDiagnosePage() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeDisease = async () => {
    if (!selectedImage) {
      setError("Please upload a photo of the affected animal");
      return;
    }

    setLoading(true);
    setError(null);
    setDiagnosis(null);

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedImage);
      
      await new Promise((resolve) => {
        reader.onloadend = resolve;
      });

      const base64Image = (reader.result as string).split(',')[1];

      // Call Claude API
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          symptoms: symptoms || "No additional symptoms provided",
          media_type: selectedImage.type,
        }),
      });

      if (!response.ok) throw new Error("Diagnosis failed");

      const result = await response.json();
      setDiagnosis(result.diagnosis);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10]">
      {/* Header */}
      <div className="bg-[#0D0F14] border-b border-[#2A2D35] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/smallRuminants/health"
              className="w-8 h-8 rounded-full bg-[#1C1E26] flex items-center justify-center text-[#9CA3AF] hover:bg-[#2A2D35]"
            >
              ←
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">AI Disease Detection</h1>
              <p className="text-xs text-[#6B7280] mt-0.5">Photo-based diagnosis</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        
        {/* Photo Upload */}
        <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4">
          <label className="block text-sm font-semibold text-[#9CA3AF] mb-2">
            Upload Photo <span className="text-red-400">*</span>
          </label>
          
          {imagePreview ? (
            <div className="relative">
              <img 
                src={imagePreview} 
                alt="Selected" 
                className="w-full h-64 object-cover rounded-lg"
              />
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full hover:bg-red-700"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="block w-full h-64 border-2 border-dashed border-[#3A3D45] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-950/10 transition-colors">
              <span className="text-4xl mb-2">📷</span>
              <span className="text-sm text-[#9CA3AF]">Tap to upload photo</span>
              <span className="text-xs text-[#6B7280] mt-1">Show affected area clearly</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Additional Symptoms */}
        <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4">
          <label className="block text-sm font-semibold text-[#9CA3AF] mb-2">
            Describe Symptoms (Optional)
          </label>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g., Not eating, coughing, limping, discharge from nose..."
            rows={4}
            className="w-full px-3 py-2 border border-[#2A2D35] rounded-lg text-sm bg-[#17191F] text-white placeholder-[#6B7280] resize-none focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        {/* Analyze Button */}
        <button
          onClick={analyzeDisease}
          disabled={loading || !selectedImage}
          className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "🔬 Analyze with AI"}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-700 rounded-xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Results */}
        {diagnosis && (
          <div className="space-y-4">
            {/* Vet Warning */}
            {diagnosis.vet_recommended && (
              <div className="bg-amber-950/40 border border-amber-700 rounded-xl p-4">
                <p className="text-sm font-bold text-amber-300 mb-1">⚠️ Veterinary Consultation Recommended</p>
                <p className="text-xs text-amber-400/80">
                  This condition may require professional veterinary care. Contact a vet as soon as possible.
                </p>
              </div>
            )}

            {/* Probable Diseases */}
            <div className="bg-[#0D0F14] rounded-xl border border-[#2A2D35] p-4">
              <h3 className="text-sm font-bold text-white mb-3">Probable Diagnoses</h3>
              <div className="space-y-3">
                {diagnosis.probable_diseases.map((disease, i) => {
                  const confidenceColor = {
                    high: "bg-emerald-950/40 text-emerald-300 border-emerald-800",
                    medium: "bg-amber-950/40 text-amber-300 border-amber-800",
                    low: "bg-[#17191F] text-[#9CA3AF] border-[#2A2D35]",
                  };

                  const urgencyColor = {
                    immediate: "bg-red-950/40 text-red-300",
                    soon: "bg-amber-950/40 text-amber-300",
                    monitor: "bg-blue-950/40 text-blue-300",
                  };

                  return (
                    <div key={i} className="border border-[#2A2D35] rounded-lg p-3 bg-[#17191F]">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-bold text-white">{disease.name}</h4>
                        <div className="flex gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${confidenceColor[disease.confidence]}`}>
                            {disease.confidence} confidence
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${urgencyColor[disease.urgency]}`}>
                            {disease.urgency}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <p className="font-semibold text-[#9CA3AF]">Symptoms:</p>
                          <ul className="list-disc list-inside text-[#D1D5DB]">
                            {disease.symptoms.map((s, j) => (
                              <li key={j}>{s}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="font-semibold text-[#9CA3AF]">Recommended Treatment:</p>
                          <p className="text-[#D1D5DB]">{disease.treatment}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* General Advice */}
            <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-300 mb-1">💡 General Advice</p>
              <p className="text-xs text-blue-200">{diagnosis.general_advice}</p>
            </div>

            {/* Disclaimer */}
            <div className="bg-[#17191F] border border-[#2A2D35] rounded-xl p-3 text-xs text-[#9CA3AF]">
              <p className="font-semibold mb-1">⚠️ Important Disclaimer:</p>
              <p>
                This AI diagnosis is for informational purposes only and should not replace professional 
                veterinary care. Always consult a licensed veterinarian for proper diagnosis and treatment.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDiagnosis(null);
                  setSelectedImage(null);
                  setImagePreview(null);
                  setSymptoms("");
                }}
                className="flex-1 px-4 py-3 rounded-lg border border-[#2A2D35] text-sm font-semibold text-[#9CA3AF] hover:bg-[#17191F]"
              >
                New Diagnosis
              </button>
              <Link
                href="/dashboard/smallRuminants/health/add"
                className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 text-center"
              >
                Record Treatment
              </Link>
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}