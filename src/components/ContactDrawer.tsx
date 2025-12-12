import * as React from "react";
import { Mail, MessageCircle, Send, Loader2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useContactDrawer } from "@/App";
import { cn } from "@/lib/utils";

interface FormData {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
}

const sendEmail = async (data: FormData): Promise<boolean> => {
    // ... (mesma lógica de antes)
    const API_ENDPOINT = '/api/send-contact';

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido do servidor.' }));
            console.error("Erro no envio do e-mail:", errorData);
            throw new Error(errorData.message || `Erro do servidor: ${response.status}`);
        }

        return true;

    } catch (error) {
        console.error("Falha ao enviar e-mail:", error);
        return false;
    }
};

const WhatsAppIcon = ({ className, fill = "currentColor" }: { className?: string; fill?: string }) => (
    <FaWhatsapp className={cn("w-5 h-5", className)} style={{ color: fill }} />
);

const ContactForm = ({ onClose }: { onClose: () => void }) => {
    // ... (mesma lógica de form)
    const [formData, setFormData] = React.useState<FormData>({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
    });

    const [isLoading, setIsLoading] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const success = await sendEmail(formData);
        setIsLoading(false);

        if (success) {
            toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
            setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
            onClose();
        } else {
            toast.error("Houve um erro ao enviar sua mensagem. Tente novamente mais tarde.");
        }
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 p-3 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label htmlFor="name" className="text-xs">Nome *</Label>
                    <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Seu nome"
                        required
                        className="h-9 text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="phone" className="text-xs">Telefone *</Label>
                    <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="(00) 00000-0000"
                        required
                        className="h-9 text-sm"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">E-mail *</Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="email@email.com"
                    required
                    className="h-9 text-sm"
                />
            </div>

            <div className="space-y-1">
                <Label htmlFor="subject" className="text-xs">Assunto</Label>
                <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="Qual o assunto?"
                    className="h-9 text-sm"
                />
            </div>

            <div className="space-y-1">
                <Label htmlFor="message" className="text-xs">Mensagem *</Label>
                <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Conte-nos seu caso..."
                    rows={3}
                    required
                    className="text-sm"
                />
            </div>

            <Button
                type="submit"
                className="w-full h-10 bg-accent hover:bg-accent/90 text-accent-foreground text-sm"
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                    </>
                ) : (
                    <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar
                    </>
                )}
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
                Resposta em até 24h úteis.
            </p>
        </form>
    );
};

export const ContactDrawer = () => {
    const { isDrawerOpen, closeDrawer, openDrawer } = useContactDrawer();
    const [activeTab, setActiveTab] = React.useState<"email" | "whatsapp">("email");

    const whatsappLink =
        "https://wa.me/5587988448690?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20um%20advogado.";

    return (
        <>
            <Button
                size="lg"
                className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full p-0 shadow-2xl bg-accent hover:bg-accent/90 text-white"
                onClick={openDrawer}
                aria-label="Abrir contato"
            >
                <MessageCircle className="h-7 w-7" />
            </Button>

            <Dialog open={isDrawerOpen} onOpenChange={closeDrawer}>
                <DialogContent
                    className="
                        w-[94%]
                        max-w-sm
                        sm:max-w-lg
                        p-0
                        max-h-[90vh] /* Reduzi um pouco a altura maxima */
                        overflow-hidden
                        rounded-lg
                        sm:rounded-lg
                        flex flex-col /* Adicionado para organizar header e content */
                    "
                >
                    <DialogHeader className="p-3 border-b border-border text-center flex-shrink-0">
                        <DialogTitle className="text-lg font-bold">
                            Fale Conosco
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Escolha como deseja ser atendido.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-center p-2 border-b border-border flex-shrink-0">
                        <div className="flex bg-muted rounded-lg p-1">
                            <Button
                                variant="ghost"
                                className={cn(
                                    "rounded px-3 py-1 flex items-center gap-1 text-xs w-24 justify-center",
                                    activeTab === "email" &&
                                    "bg-background text-foreground shadow-sm"
                                )}
                                onClick={() => setActiveTab("email")}
                            >
                                <Mail className="h-3 w-3" />
                                Formulário
                            </Button>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "rounded px-3 py-1 flex items-center gap-1 text-xs w-24 justify-center",
                                    activeTab === "whatsapp" &&
                                    "bg-background text-foreground shadow-sm"
                                )}
                                onClick={() => setActiveTab("whatsapp")}
                            >
                                <WhatsAppIcon className="h-3 w-3" />
                                WhatsApp
                            </Button>
                        </div>
                    </div>

                    {/* Adicionado overflow-y-auto aqui pra essa porra scrollar */}
                    <div className="flex-1 overflow-y-auto pb-4">
                        {activeTab === "email" && (
                            <>
                                <div className="px-3 pt-3 pb-1 text-center">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        Envie sua Mensagem
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground">
                                        Responderemos rapidamente.
                                    </p>
                                </div>
                                <ContactForm onClose={closeDrawer} />
                            </>
                        )}

                        {activeTab === "whatsapp" && (
                            <div className="p-4 text-center space-y-4">
                                <WhatsAppIcon className="h-8 w-8 text-[#25D366] mx-auto" />
                                <h3 className="text-sm font-semibold">Atendimento Imediato</h3>
                                <p className="text-xs text-muted-foreground">
                                    Fale conosco diretamente no WhatsApp.
                                </p>

                                <Button
                                    asChild
                                    size="sm"
                                    className="w-full h-10 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm"
                                >
                                    <a
                                        href={whatsappLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={closeDrawer}
                                    >
                                        <WhatsAppIcon className="mr-2 h-4 w-4" fill="white" />
                                        Chamar no WhatsApp
                                    </a>
                                </Button>

                                <p className="text-[10px] text-muted-foreground">
                                    Segunda a Sexta: 8h às 18h
                                </p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};