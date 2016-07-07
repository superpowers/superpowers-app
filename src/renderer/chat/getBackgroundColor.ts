export default function getBackgroundColor(name: string) {
  const color = intToRGB(hashCode(name));

  return `rgba(${parseInt(color.substring(0, 2), 16)}, ${parseInt(color.substring(2, 4), 16)}, ${parseInt(color.substring(4, 6), 16)}, 0.2)`;
}

function hashCode(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return hash;
}

function intToRGB(i: number){
    const c = (i & 0x00FFFFFF).toString(16).toUpperCase();
    return "00000".substring(0, 6 - c.length) + c;
}
