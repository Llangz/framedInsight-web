      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.back()} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft />
        </button>
        <div>
          <h1 className="text-base font-bold">Record Activity</h1>
          <p className="text-xs text-gray-400">Step {step} of {STEPS.length}</p>
        </div>
        {isOffline && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
            <AlertCircle size={12} className="text-amber-600" />
            <span className="font-medium">Offline</span>
          </div>
        )}
      </div>
