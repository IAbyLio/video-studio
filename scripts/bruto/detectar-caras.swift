// detectar-caras.swift — detección de caras con el framework Vision de macOS (viene con el sistema: sin npm,
// sin Python, sin modelos que descargar). Lo llama encuadrar.mjs; se compila una vez a ~/.cache/video-studio-bruto/.
//
// Uso: detectar-caras <img1.png> [img2.png ...]
// Salida (stdout, una línea JSON por imagen):
//   {"img":"<ruta>","ancho":W,"alto":H,"caras":[{"x":..,"y":..,"w":..,"h":..,"conf":..}]}
// Coordenadas en píxeles de la imagen, origen ARRIBA a la izquierda (Vision trabaja con origen abajo: se convierte).
import Foundation
import Vision
import ImageIO

func procesar(_ ruta: String) -> String {
    let url = URL(fileURLWithPath: ruta)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        return "{\"img\":\"\(ruta)\",\"error\":\"no se pudo leer la imagen\"}"
    }
    let W = Double(img.width), H = Double(img.height)
    let peticion = VNDetectFaceRectanglesRequest()
    let manejador = VNImageRequestHandler(cgImage: img, options: [:])
    do { try manejador.perform([peticion]) } catch {
        return "{\"img\":\"\(ruta)\",\"error\":\"Vision: \(error.localizedDescription)\"}"
    }
    var caras: [String] = []
    for o in (peticion.results ?? []) {
        let b = o.boundingBox  // normalizado, origen abajo-izquierda
        let x = b.origin.x * W, w = b.size.width * W, h = b.size.height * H
        let y = (1.0 - b.origin.y - b.size.height) * H
        caras.append(String(format: "{\"x\":%.1f,\"y\":%.1f,\"w\":%.1f,\"h\":%.1f,\"conf\":%.3f}", x, y, w, h, o.confidence))
    }
    return "{\"img\":\"\(ruta)\",\"ancho\":\(Int(W)),\"alto\":\(Int(H)),\"caras\":[\(caras.joined(separator: ","))]}"
}

let args = Array(CommandLine.arguments.dropFirst())
if args.isEmpty {
    FileHandle.standardError.write("uso: detectar-caras <img...>\n".data(using: .utf8)!)
    exit(1)
}
for a in args { print(procesar(a)) }
