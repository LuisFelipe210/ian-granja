import logoMobile from "@/assets/logo3.jpg";

export const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary transition-opacity duration-600">
            <div className="relative flex flex-col items-center justify-center">
                <img
                    src={logoMobile}
                    alt="Carregando..."
                    className="w-64 h-64 sm:w-96 sm:h-96 object-contain animate-balance drop-shadow-2xl rounded-xl"
                />

                <div className="-mt-16 flex flex-col items-center gap-3">
                    <div className="h-1.5 w-48 bg-primary-foreground/20 rounded-full overflow-hidden">
                        <div className="h-full w-full bg-accent animate-progress origin-left"></div>
                    </div>
                    <p className="text-xs text-primary-foreground/80 font-medium tracking-widest uppercase animate-pulse">
                        Carregando
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes progress {
                    0% { transform: scaleX(0); }
                    100% { transform: scaleX(1); }
                }
                .animate-progress {
                    animation: progress 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};