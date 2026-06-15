import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type LetterSheetProps = {
  children: ReactNode;
  className?: string;
  sheetClassName?: string;
  contentClassName?: string;
  texture?: boolean;
  textureName?: string;
  deckle?: boolean;
  aging?: boolean;
  folds?: boolean;
};

type PaperTextureStyle = CSSProperties & {
  "--paper-tex"?: string;
};

export function LetterSheet({
  children,
  className,
  sheetClassName,
  contentClassName,
  texture = true,
  textureName = "cream-paper",
  deckle = false,
  aging = false,
  folds = false,
}: LetterSheetProps) {
  const textureStyle: PaperTextureStyle = {
    "--paper-tex": `url(/textures/${textureName}.png)`,
  };

  return (
    <div className={cn("letter-lift", className)}>
      <div
        className={cn(
          "letter-sheet min-h-full",
          deckle && "letter-sheet--deckle",
          sheetClassName
        )}
      >
        {texture && (
          <div
            className="letter-texture"
            style={textureStyle}
            aria-hidden="true"
          />
        )}
        {aging && <div className="letter-aging" aria-hidden="true" />}
        {folds && <div className="letter-folds" aria-hidden="true" />}
        <div className={cn("relative z-10", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
