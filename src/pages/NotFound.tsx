import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Cta, TextLink } from "@/components/Cta";
import { Rise } from "@/components/PageHero";
import { Grifo } from "@/components/Grifo";
import { HeroArt } from "@/components/HeroArt";

const NotFound = () => (
    <div className="flex min-h-screen flex-col bg-ink text-paper">
        <Navigation />

        <main className="container grid flex-1 items-center gap-x-12 pb-24 pt-40 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h1 className="display text-[clamp(2.5rem,5.6vw,4.75rem)]">
                <Rise>Esta folha</Rise>
                <Rise delay={0.09}>
                    está <Grifo delay={900}>em branco.</Grifo>
                </Rise>
            </h1>
            <p className="mt-8 max-w-[48ch] text-lg leading-relaxed text-paper/80">
                A página que você procurou não existe ou foi movida. O endereço pode ter sido digitado errado.
            </p>
            <div className="mt-10 flex flex-col gap-x-8 gap-y-5 sm:flex-row sm:items-center">
                <Cta to="/">Voltar ao início</Cta>
                <TextLink to="/atuacao" className="text-paper">
                    Ver áreas de atuação
                </TextLink>
            </div>
          </div>
          <div className="hidden lg:col-span-4 lg:block">
            <HeroArt variant="branco" />
          </div>
        </main>

        <Footer />
    </div>
);

export default NotFound;
